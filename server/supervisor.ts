import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AuthConfig } from './config.ts'

export interface Principal { id: string; email: string; role: 'supervisor'; team_id: string; team_name: string; dataMode: string }
export class AccessError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status } }

export function restClient(config: AuthConfig, accessToken: string, request = fetch) {
  return (path: string, options: RequestInit = {}) => request(`${config.supabaseUrl}/rest/v1/${path}`, {
    ...options, headers: { apikey: config.publishableKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    signal: AbortSignal.timeout(15000), redirect: 'error',
  })
}
export async function supervisorProfile(config: AuthConfig, token: string, user: { id: string; email: string }, request = fetch): Promise<Principal> {
  const rest = restClient(config, token, request)
  const response = await rest(`profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role,team_id`)
  if (!response.ok) throw new AccessError(503, 'Supervisor access is not configured. Contact your administrator.')
  const profiles = await response.json() as Array<{ id: string; role: string; team_id: string }>
  const profile = profiles[0]
  if (!profile || profile.role !== 'supervisor' || !profile.team_id) throw new AccessError(403, 'This account does not have supervisor access. Ask your administrator to assign a team.')
  const teamResponse = await rest(`teams?id=eq.${encodeURIComponent(profile.team_id)}&select=id,name,data_mode`)
  if (!teamResponse.ok) throw new AccessError(503, 'Unable to verify your team. Please try again.')
  const teams = await teamResponse.json() as Array<{ name: string; data_mode: string }>
  if (teams.length !== 1 || (teams[0].data_mode !== config.dataMode && !['synthetic', 'live'].includes(teams[0].data_mode))) throw new AccessError(403, 'Your team is not enabled for this workspace data mode.')
  return { ...user, role: 'supervisor', team_id: profile.team_id, team_name: teams[0].name, dataMode: config.dataMode }
}
const selections: Record<string, string> = {
  water_sources: '*', cases: '*', screening_records: 'id,team_id,source_id,sample_code,machine_suggestion,human_observation,screening_flag,captured_at,received_at,created_by,capture_name,capture_type',
  lab_reports: 'id,team_id,case_id,source_id,screening_id,report_number,lab_name,result,file_name,file_type,file_sha256,uploaded_at,uploaded_by,verification_status,verified_at,verified_by,verification_note',
  case_actions: 'id,team_id,case_id,kind,description,performed_by,performed_at,evidence_name,evidence_type,created_at,created_by',
  retests: '*', resident_communications: '*', ivr_complaints: '*', audit_log: '*',
}
const mutations: Record<string, string[]> = {
  cases: ['POST'], lab_reports: ['POST'], case_actions: ['POST'], retests: ['POST','PATCH'], resident_communications: ['POST'], water_sources: ['PATCH'],
  'rpc/create_case_from_ivr': ['POST'], 'rpc/verify_lab_report': ['POST'], 'rpc/close_case': ['POST'], 'rpc/link_ivr_complaint_to_case': ['POST','PATCH'], 'rpc/verify_case_audit': ['POST'],
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function validateFile(input: Record<string, unknown>) {
  const data = input.file_base64 ?? input.evidence_base64
  if (data === undefined || data === null) return
  const mime = input.file_type ?? input.evidence_type
  if (typeof data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) throw new AccessError(400, 'Invalid attachment encoding.')
  const bytes = Buffer.from(data, 'base64')
  if (bytes.length > 2 * 1024 * 1024 || bytes.length < 4) throw new AccessError(400, 'Choose a PDF, PNG, or JPEG file up to 2 MB.')
  const good = mime === 'application/pdf' ? bytes.subarray(0,5).toString() === '%PDF-' : mime === 'image/png' ? bytes.subarray(0,8).toString('hex') === '89504e470d0a1a0a' : mime === 'image/jpeg' && bytes.subarray(0,3).toString('hex') === 'ffd8ff'
  if (!good) throw new AccessError(400, 'The attachment content does not match its file type.')
}
export async function supervisorApi(req: IncomingMessage, res: ServerResponse, config: AuthConfig, token: string, principal: Principal, request = fetch) {
  const reply = (status: number, body: object) => { res.statusCode = status; res.end(JSON.stringify(body)) }
  const url = new URL(req.url!, 'http://local')
  const path = url.pathname.replace('/api/supervisor/', '')
  const rest = restClient(config, token, request)
  const getRows = async (table: string) => {
    const params = new URLSearchParams({ select: selections[table], team_id: `eq.${principal.team_id}`, limit: '1001' })
    if (table === 'audit_log') params.set('order','sequence.asc')
    const result = await rest(`${table}?${params}`)
    if (!result.ok) {
      throw new AccessError(503, 'Unable to load team records. Please retry or contact your administrator.')
    }
    const rows = await result.json() as unknown[]
    if (rows.length > 1000) throw new AccessError(413, 'This team exceeds the current board limit. Ask your administrator to enable paginated access.')
    return rows
  }
  try {
    if (path === 'workspace' && req.method === 'GET') {
      const tables = Object.keys(selections)
      const data = await Promise.all(tables.map(async table => [table, await getRows(table)]))
      return reply(200, { ...Object.fromEntries(data), profile: principal })
    }

    if (path === 'export' && req.method === 'GET') {
      const cases = await getRows('cases') as Array<{ status: string; priority: string }>
      // Only fixed labels and aggregate counts: no identities, locations, notes or attachments.
      const rows = [['data_mode','metric','count'], [principal.dataMode,'total_cases',String(cases.length)], ...['under_review','closed'].map(status => [principal.dataMode,status,String(cases.filter(c => c.status===status).length)]), ...['normal','urgent','critical'].map(priority => [principal.dataMode,`priority_${priority}`,String(cases.filter(c => c.priority===priority).length)])]
      res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="jalsakshi-safe-summary.csv"')
      res.end(rows.map(row => row.join(',')).join('\r\n'));return
    }
    if (path.startsWith('files/') && req.method === 'GET') {
      const [,table,id] = path.split('/')
      if (!['lab_reports','case_actions','screening_records'].includes(table) || !uuid.test(id || '')) throw new AccessError(400,'Invalid attachment request.')
      const response = await rest(`${table}?id=eq.${id}&team_id=eq.${principal.team_id}&select=*`)
      if (!response.ok) throw new AccessError(503,'Unable to download attachment.')
      const rows = await response.json() as Array<Record<string,string>>
      const row = rows[0];const data = row?.file_base64 || row?.evidence_base64 || row?.capture_base64
      if (!data) throw new AccessError(404,'Attachment not found.')
      const fileName = (row.file_name || row.evidence_name || row.capture_name || 'evidence').replace(/[^a-zA-Z0-9._-]/g,'_')
      res.setHeader('Content-Type',row.file_type || row.evidence_type || row.capture_type || 'application/octet-stream')
      res.setHeader('Content-Disposition',`attachment; filename="${fileName}"`);res.setHeader('X-Content-Type-Options','nosniff')
      res.end(Buffer.from(data,'base64'));return
    }
    if (!mutations[path]?.includes(req.method || '')) throw new AccessError(405,'This operation is not available to supervisors.')
    let raw = ''
    for await (const chunk of req) { raw += chunk; if(Buffer.byteLength(raw)>3000000) throw new AccessError(413,'Request exceeds the 2 MB attachment limit.') }
    let input: Record<string,unknown>
    try { input = JSON.parse(raw) } catch { throw new AccessError(400,'Invalid request.') }
    if (!input || Array.isArray(input) || typeof input!=='object') throw new AccessError(400,'Invalid request.')
    validateFile(input)
    const params = new URLSearchParams()
    if (!path.startsWith('rpc/')) {
      if(req.method === 'POST') input.team_id = principal.team_id
      if(req.method === 'PATCH') {
        const id = url.searchParams.get('id')
        if(!id?.startsWith('eq.') || !uuid.test(id.slice(3))) throw new AccessError(400,'Select one record to update.')
        params.set('id',id);params.set('team_id',`eq.${principal.team_id}`)
      }
    }
    const response = await rest(`${path}${params.size ? `?${params}` : ''}`, { method: path.startsWith('rpc/') ? 'POST' : req.method, body: JSON.stringify(input) })
    const output = await response.json() as { code?: string; message?: string }
    if(!response.ok) {
      const code = output.code
      if(code==='PT409' || code==='40001' || code==='23505') throw new AccessError(409,output.message || 'Record changed. Refresh and try again.')
      if(code==='42501') throw new AccessError(403,'This action is outside your permitted role or team.')
      if(code==='23514' || code==='23503' || code==='23502') throw new AccessError(422,output.message || 'Required evidence is missing or mismatched.')
      throw new AccessError(400,'The action could not be saved. Check the fields and refresh the case.')
    }
    // Mutation bodies can include private file data; do not echo them back.
    return reply(200, { ok: true, ...(path==='rpc/verify_case_audit' ? { valid: output } : {}) })
  } catch(error) {
    if(error instanceof AccessError) return reply(error.status,{error:error.message})
    return reply(503,{error:'The service is unavailable. Please retry; your action was not confirmed.'})
  }
}

