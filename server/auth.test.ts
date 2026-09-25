import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { createAuthHandler } from './auth.ts'
import { readConfig } from './config.ts'

const env = { JALSAKSHI_SUPABASE_URL: 'https://example.supabase.co', JALSAKSHI_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }
const config = readConfig(env)
const json = (body: object, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))
const success = () => json({ access_token: 'provider-secret-token', refresh_token: 'refresh-secret', expires_in: 3600, user: { id: 'test-user', email: 'test@example.org' } })

async function withServer(provider: typeof fetch, run: (base: string) => Promise<void>) {
  const withProfile: typeof fetch = (url, options) => {
    if(String(url).includes('/rest/v1/profiles')) return json([{id:'test-user',role:'supervisor',team_id:'test-team'}])
    if(String(url).includes('/rest/v1/teams')) return json([{id:'test-team',name:'Test team',data_mode:'synthetic'}])
    return provider(url,options)
  }
  const handler = createAuthHandler(config, withProfile)
  const server = createServer((req, res) => handler(req, res, () => { res.statusCode = 404; res.end() }))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert(address && typeof address === 'object')
  try { await run(`http://127.0.0.1:${address.port}`) } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
}
const login = (base: string, body = { email: 'test@example.org', password: 'test-password' }) => fetch(`${base}/api/auth/login?from=test`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

test('configuration rejects missing keys, Markdown, secret keys, and unsupported live data', () => {
  assert.throws(() => readConfig({}), /Set JALSAKSHI/)
  assert.throws(() => readConfig({ ...env, JALSAKSHI_SUPABASE_URL: '[https://example.supabase.co](https://example.supabase.co)' }), /plain HTTPS/)
  assert.throws(() => readConfig({ ...env, JALSAKSHI_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_unsafe' }), /publishable key/)
  assert.throws(() => readConfig({ ...env, JALSAKSHI_TENANT_DATA_MODE: 'invalid_mode' }), /synthetic|live/)
  assert.throws(() => readConfig({ ...env, JALSAKSHI_ENVIRONMENT: 'production' }), /SESSION_SECRET/)
  assert.equal(readConfig({ ...env, JALSAKSHI_ENVIRONMENT: 'production', JALSAKSHI_SESSION_SECRET: 'x'.repeat(32) }).secureCookie, true)
})

test('Supabase login, provider validation, opaque cookie, and logout invalidation', async () => {
  const calls: string[] = []
  let revoked = false
  await withServer(async (url, options) => {
    calls.push(String(url))
    assert.equal(new Headers(options?.headers).get('apikey'), config.publishableKey)
    if (String(url).includes('/token')) {
      assert.deepEqual(JSON.parse(String(options?.body)), { email: 'test@example.org', password: 'test-password' })
      return success()
    }
    assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer provider-secret-token')
    if (String(url).endsWith('/logout?scope=local')) revoked = true
    if (String(url).endsWith('/user')) return revoked ? json({ error: 'session_not_found' }, 403) : json({ id: 'test-user', email: 'test@example.org' })
    return new Response(null, { status: 204 })
  }, async base => {
    assert.equal((await fetch(`${base}/api/auth/session`)).status, 401)
    const response = await login(base)
    assert.equal(response.status, 200)
    const body = await response.text()
    assert(!body.includes('provider-secret-token') && !body.includes('refresh-secret'))
    const header = response.headers.get('set-cookie')!
    assert.match(header, /HttpOnly; SameSite=Strict/)
    assert.match(header, /Max-Age=3600/)
    assert(!header.includes('provider-secret-token'))
    const cookie = header.split(';')[0]
    assert.equal((await fetch(`${base}/api/auth/session`, { headers: { Cookie: cookie.slice(0, -2) + 'AA' } })).status, 401)
    assert.equal((await fetch(`${base}/api/auth/session`, { headers: { Cookie: cookie } })).status, 200)
    assert.equal((await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { Origin: base, Cookie: cookie } })).status, 200)
    assert.equal((await fetch(`${base}/api/auth/session`, { headers: { Cookie: cookie } })).status, 401)
    assert(calls.some(url => url.endsWith('/logout?scope=local')))
  })
})

test('bad credentials are denied and repeated attempts are limited', async () => {
  let count = 0
  await withServer(() => { count++; return json({ error: 'invalid_grant' }, 400) }, async base => {
    for (let i = 0; i < 10; i++) assert.equal((await login(base)).status, 401)
    assert.equal((await login(base)).status, 429)
    assert.equal(count, 10)
  })
})

test('cross-origin and oversized requests do not reach Supabase', async () => {
  await withServer(() => { throw new Error('Should not call provider') }, async base => {
    assert.equal((await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { Origin: 'https://other.example' } })).status, 403)
    assert.equal((await login(base, { email: 'test@example.org', password: 'x'.repeat(5000) })).status, 413)
  })
})

test('provider outage fails closed and does not leak upstream diagnostics', async () => {
  await withServer(() => { throw new Error('private-provider-diagnostics') }, async base => {
    const response = await login(base)
    assert.equal(response.status, 503)
    assert(!(await response.text()).includes('private-provider-diagnostics'))
    assert.equal(response.headers.get('set-cookie'), null)
  })
})

test('demo-looking credentials still require provider authentication', async () => {
  await withServer(() => json({ error: 'invalid_grant' }, 400), async base => {
    for (const body of [
      { email: 'demo.supervisor@jalsakshi.local', password: 'demo1234' },
      { email: 'anyone@example.org', password: 'demo' },
    ]) {
      const response = await login(base, body)
      assert.equal(response.status, 401)
      assert.equal(response.headers.get('set-cookie'), null)
    }
  })
})

test('revoked provider credentials invalidate the local session', async () => {
  await withServer(url => String(url).includes('/token') ? success() : json({ error: 'invalid_token' }, 401), async base => {
    const response = await login(base)
    const cookie = response.headers.get('set-cookie')!.split(';')[0]
    const session = await fetch(`${base}/api/auth/session`, { headers: { Cookie: cookie } })
    assert.equal(session.status, 401)
    assert.match(session.headers.get('set-cookie')!, /Max-Age=0/)
  })
})
