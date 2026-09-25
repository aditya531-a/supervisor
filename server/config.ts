import { createHash, randomBytes } from 'node:crypto'

export function readConfig(env: Record<string, string | undefined>) {
  const environment = env.JALSAKSHI_ENVIRONMENT || 'development'
  if (!['development', 'test', 'production'].includes(environment)) throw new Error('JALSAKSHI_ENVIRONMENT must be development, test, or production.')
  const dataMode = env.JALSAKSHI_TENANT_DATA_MODE || 'synthetic'
  if (dataMode !== 'synthetic') throw new Error('Only synthetic tenant data is implemented. Live database workflows are not connected.')
  const backendUrl = env.JALSAKSHI_BACKEND_URL || env.JALSAKSHI_SUPABASE_URL
  const supabaseUrl = env.JALSAKSHI_SUPABASE_URL || backendUrl
  const publishableKey = env.JALSAKSHI_SUPABASE_PUBLISHABLE_KEY
  if (!supabaseUrl || !publishableKey) throw new Error('Set JALSAKSHI_SUPABASE_URL and JALSAKSHI_SUPABASE_PUBLISHABLE_KEY in .env. See .env.example.')
  let url: URL
  try { url = new URL(supabaseUrl) } catch { throw new Error('JALSAKSHI_SUPABASE_URL must be a plain HTTPS URL, without Markdown.') }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('JALSAKSHI_SUPABASE_URL must be an HTTPS origin.')
  if (!publishableKey.startsWith('sb_publishable_')) throw new Error('JALSAKSHI_SUPABASE_PUBLISHABLE_KEY must be a publishable key, not a secret or service-role key.')
  const sessionSecret = env.JALSAKSHI_SESSION_SECRET
  if (environment === 'production' && (!sessionSecret || sessionSecret.length < 32)) throw new Error('Set JALSAKSHI_SESSION_SECRET to 32+ random characters in production.')
  // Without a secret, a per-process key is used: fine for one dev server, breaks across serverless instances.
  const sessionKey = sessionSecret ? createHash('sha256').update(sessionSecret).digest() : randomBytes(32)
  return { environment, dataMode, backendUrl: new URL(backendUrl || supabaseUrl).origin, supabaseUrl: url.origin, publishableKey, sessionKey, secureCookie: environment === 'production' || env.AUTH_SECURE_COOKIE === 'true' }
}

export type AuthConfig = ReturnType<typeof readConfig>


