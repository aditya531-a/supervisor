// Standalone backend (Render: `npm start`). Same Supabase-backed API as the Vite dev server and Vercel function.
import { createServer } from 'node:http'
import { createAuthHandler } from './auth.ts'
import { readConfig } from './config.ts'

const api = createAuthHandler(readConfig(process.env))
const port = Number(process.env.PORT) || 3000

createServer((req, res) => {
  if (req.url === '/health') return res.end('ok')
  api(req, res, () => {
    res.statusCode = 404; res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Not found.' }))
  })
}).listen(port, () => console.log(`JalSakshi supervisor API on :${port}`))
