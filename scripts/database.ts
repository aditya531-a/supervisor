import pg from 'pg'
export async function database() {
  if (!process.env.JALSAKSHI_DATABASE_URL) throw new Error('Missing JALSAKSHI_DATABASE_URL')
  const response = await fetch('https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt', { signal: AbortSignal.timeout(10000) })
  if (!response.ok) throw new Error('Could not load the Supabase database CA certificate')
  const url = new URL(process.env.JALSAKSHI_DATABASE_URL)
  url.searchParams.delete('sslmode')
  const client = new pg.Client({ connectionString: url.toString(), ssl: { ca: await response.text(), rejectUnauthorized: true }, connectionTimeoutMillis: 10000 })
  await client.connect()
  return client
}

export async function assertSupervisorSchema(db: Awaited<ReturnType<typeof database>>) {
  const { rows } = await db.query("select to_regclass('public.screening_records') is not null and exists(select 1 from information_schema.columns where table_schema='public' and table_name='teams' and column_name='data_mode') as ready")
  if (!rows[0]?.ready) throw new Error('Configured database lacks the JalSakshi supervisor schema. Use a compatible Supabase project before running fixtures.')
}
