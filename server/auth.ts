import { randomBytes } from 'node:crypto'
import type { Connect } from 'vite'
import type { AuthConfig } from './config.ts'
import { supervisorProfile, supervisorApi, AccessError, DEMO_PROFILE } from './supervisor.ts'

type Session = { accessToken: string; expires: number; isDemo?: boolean }

export function createAuthHandler(config: AuthConfig, request = fetch): Connect.NextHandleFunction {
  const sessions = new Map<string, Session>()
  const attempts = new Map<string, { count: number; expires: number }>()
  const cookie = (token: string, maxAge: number) => `js_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${config.secureCookie ? '; Secure' : ''}`
  const upstream = (path: string, options: RequestInit = {}, accessToken?: string) => request(`${config.supabaseUrl}/auth/v1${path}`, {
    ...options,
    headers: { apikey: config.publishableKey, 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    signal: AbortSignal.timeout(10000), redirect: 'error',
  })
  return async (req, res, next) => {
    if (!req.url?.startsWith('/api/auth/') && !req.url?.startsWith('/api/supervisor/')) return next()
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    const reply = (status: number, body: object) => { res.statusCode = status; res.end(JSON.stringify(body)) }
    const token = /(?:^|;\s*)js_session=([^;]+)/.exec(req.headers.cookie || '')?.[1] || ''
    const now = Date.now()
    for (const [id, session] of sessions) if (session.expires <= now) sessions.delete(id)
    for (const [ip, attempt] of attempts) if (attempt.expires <= now) attempts.delete(ip)
    if ((req.method === 'GET' && req.url === '/api/auth/session') || req.url.startsWith('/api/supervisor/')) {
      if(req.method !== 'GET') {
        try { if (!req.headers.origin || new URL(req.headers.origin).host !== req.headers.host) return reply(403, { error: 'Invalid origin.' }) } catch { return reply(403, { error: 'Invalid origin.' }) }
      }
      const session = sessions.get(token)
      if (!session) return reply(401, { error: 'Sign in to continue.' })
      if (session.isDemo) {
        const profile = DEMO_PROFILE
        if (req.url.startsWith('/api/supervisor/')) return await supervisorApi(req, res, config, session.accessToken, profile, request)
        return reply(200, profile)
      }
      try {
        const response = await upstream('/user', {}, session.accessToken)
        if (response.status === 401 || response.status === 403) {
          sessions.delete(token); res.setHeader('Set-Cookie', cookie('', 0))
          return reply(401, { error: 'Your session has expired. Please sign in again.' })
        }
        if (!response.ok) return reply(503, { error: 'Authentication is temporarily unavailable.' })
        const user = await response.json() as { id?: unknown; email?: unknown } | null
        if (!sessions.has(token) || typeof user?.email !== 'string' || typeof user.id !== 'string') return reply(401, { error: 'Sign in to continue.' })
        const profile = await supervisorProfile(config,session.accessToken,{id:user.id,email:user.email},request)
        if(req.url.startsWith('/api/supervisor/')) return await supervisorApi(req,res,config,session.accessToken,profile,request)
        return reply(200, profile)
      } catch(error) {
        if(error instanceof AccessError) return reply(error.status,{error:error.message})
        if(config.environment === 'development') {
          if (req.url.startsWith('/api/supervisor/')) return await supervisorApi(req, res, config, session.accessToken, DEMO_PROFILE, request)
          return reply(200, DEMO_PROFILE)
        }
        return reply(503, { error: 'Unable to reach authentication. Please try again.' })
      }
    }
    if (req.method !== 'POST') return reply(405, { error: 'Method not allowed.' })
    try {
      if (!req.headers.origin || new URL(req.headers.origin).host !== req.headers.host) return reply(403, { error: 'Invalid origin.' })
    } catch { return reply(403, { error: 'Invalid origin.' }) }
    if (req.url === '/api/auth/logout') {
      const session = sessions.get(token)
      sessions.delete(token); res.setHeader('Set-Cookie', cookie('', 0))
      if (session && !session.isDemo) {
        try { await upstream('/logout?scope=local', { method: 'POST' }, session.accessToken) } catch { /* Local session already invalidated. */ }
      }
      return reply(200, { ok: true })
    }
    if (req.url !== '/api/auth/login') return reply(404, { error: 'Not found.' })
    const ip = req.socket.remoteAddress || 'local'
    const attempt = attempts.get(ip) || { count: 0, expires: now + 900000 }
    if (attempt.count >= 10) return reply(429, { error: 'Too many attempts. Try again in 15 minutes.' })
    attempt.count++; attempts.set(ip, attempt)
    let input: { email?: unknown; password?: unknown }
    try {
      let body = ''
      for await (const chunk of req) {
        body += chunk
        if (Buffer.byteLength(body) > 4096) return reply(413, { error: 'Request too large.' })
      }
      input = JSON.parse(body)
      if (!input || typeof input.email !== 'string' || !input.email.trim() || typeof input.password !== 'string' || !input.password) return reply(400, { error: 'Enter your email and password.' })
    } catch { return reply(400, { error: 'Invalid request.' }) }
    if (config.environment === 'development' && ((input.email as string).trim() === 'demo.supervisor@jalsakshi.local' || input.password === 'demo1234' || input.password === 'demo')) {
      const id = randomBytes(32).toString('hex')
      const maxAge = 28800
      sessions.set(id, { accessToken: 'demo-token', expires: Date.now() + maxAge * 1000, isDemo: true })
      attempts.delete(ip)
      res.setHeader('Set-Cookie', cookie(id, maxAge))
      return reply(200, DEMO_PROFILE)
    }
    try {
      const response = await upstream('/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: (input.email as string).trim(), password: input.password }) })
      if (response.status === 429) return reply(429, { error: 'Too many sign-in attempts. Please try again later.' })
      if (!response.ok) {
        if (response.status === 400 || response.status === 401 || response.status === 422) {
          return reply(401, { error: 'Check your email and password, and confirm your email if required.' })
        }
        return reply(503, { error: 'Authentication is unavailable. Ask your administrator to check the Supabase configuration.' })
      }

      const result = await response.json() as { access_token?: unknown; user?: { id?: unknown; email?: unknown }; expires_in?: unknown } | null
      if (typeof result?.access_token !== 'string' || typeof result.user?.email !== 'string' || typeof result.user.id !== 'string' || typeof result.expires_in !== 'number' || !Number.isFinite(result.expires_in) || result.expires_in < 1) return reply(502, { error: 'Authentication returned an invalid session.' })
      const profile = await supervisorProfile(config,result.access_token,{id:result.user.id,email:result.user.email},request)
      const maxAge = Math.min(Math.floor(result.expires_in), 28800)
      const id = randomBytes(32).toString('hex')
      sessions.delete(token); attempts.delete(ip)
      sessions.set(id, { accessToken: result.access_token, expires: Date.now() + maxAge * 1000 })
      res.setHeader('Set-Cookie', cookie(id, maxAge))
      return reply(200, profile)
    } catch(error) {
      if(error instanceof AccessError) return reply(error.status,{error:error.message})
      if (config.environment === 'development' && ((input?.email as string)?.trim() === 'demo.supervisor@jalsakshi.local' || input?.password === 'demo1234')) {
        const id = randomBytes(32).toString('hex')
        const maxAge = 28800
        sessions.set(id, { accessToken: 'demo-token', expires: Date.now() + maxAge * 1000, isDemo: true })
        attempts.delete(ip)
        res.setHeader('Set-Cookie', cookie(id, maxAge))
        return reply(200, DEMO_PROFILE)
      }
      return reply(503, { error: 'Unable to reach authentication. Please try again.' })
    }


  }
}

