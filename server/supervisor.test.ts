import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { createAuthHandler } from './auth.ts'
import { readConfig } from './config.ts'
const config=readConfig({JALSAKSHI_SUPABASE_URL:'https://project.supabase.co',JALSAKSHI_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',JALSAKSHI_TENANT_DATA_MODE:'synthetic'})
const json=(value:unknown,status=200,headers:HeadersInit={})=>Promise.resolve(new Response(JSON.stringify(value),{status,headers}))
async function server(run:(base:string,setRole:(role:string)=>void,setMode:(mode:string)=>void,setCaseTotal:(total:number)=>void)=>Promise<void>){
 let role='supervisor'
 let mode='synthetic'
 let caseTotal=1
 const provider:typeof fetch=(url,options)=>{
  const path=String(url)
  if(path.includes('/auth/v1/token'))return json({access_token:'private-access-token',expires_in:3600,user:{id:'user-id',email:'supervisor@example.org'}})
  if(path.endsWith('/auth/v1/user'))return json({id:'user-id',email:'supervisor@example.org'})
  if(path.includes('/profiles?'))return json([{id:'user-id',team_id:'11111111-1111-1111-1111-111111111111',role}])
  if(path.includes('/teams?'))return json([{name:'Team one',data_mode:mode}])
  if(path.includes('/cases?')){
   assert.equal(new Headers(options?.headers).get('Authorization'),'Bearer private-access-token')
   assert.equal(new Headers(options?.headers).get('Prefer'),'count=exact')
   assert(path.includes('team_id=eq.11111111-1111-1111-1111-111111111111'))
   const rows=Array.from({length:Math.min(caseTotal,1000)},()=>({id:'PRIVATE-CASE-ID',source_id:'PRIVATE-SOURCE',status:'under_review',priority:'urgent',notes:'PRIVATE OBSERVATION',name:'=HYPERLINK("evil")'}))
   return json(rows,200,{'Content-Range':`0-${rows.length-1}/${caseTotal}`})
  }
  throw new Error('Unexpected upstream path')
 }
 const handler=createAuthHandler(config,provider)
 const http=createServer((req,res)=>handler(req,res,()=>{res.statusCode=404;res.end()}))
 http.listen(0,'127.0.0.1');await once(http,'listening');const address=http.address();assert(address&&typeof address==='object')
 try{await run(`http://127.0.0.1:${address.port}`,value=>{role=value},value=>{mode=value},value=>{caseTotal=value})}finally{http.closeAllConnections();await new Promise<void>(resolve=>http.close(()=>resolve()))}
}
const login=(base:string)=>fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:'supervisor@example.org',password:'password'})})
test('workers cannot obtain a supervisor session',()=>server(async(base,setRole)=>{setRole('worker');const response=await login(base);assert.equal(response.status,403);assert.equal(response.headers.get('set-cookie'),null)}))
test('teams in another data mode cannot obtain a session',()=>server(async(base,_setRole,setMode)=>{setMode('live');const response=await login(base);assert.equal(response.status,403);assert.equal(response.headers.get('set-cookie'),null)}))
test('role changes invalidate access on the next authenticated request',()=>server(async(base,setRole)=>{const response=await login(base);assert.equal(response.status,200);const cookie=response.headers.get('set-cookie')!.split(';')[0];setRole('worker');const next=await fetch(base+'/api/supervisor/workspace',{headers:{Cookie:cookie}});assert.equal(next.status,403)}))
test('export uses user RLS token and excludes private values and spreadsheet formulas',()=>server(async base=>{const response=await login(base);const cookie=response.headers.get('set-cookie')!.split(';')[0];const exported=await fetch(base+'/api/supervisor/export',{headers:{Cookie:cookie}});assert.equal(exported.status,200);const csv=await exported.text();assert.match(csv,/(synthetic|live),under_review,1/);assert(!/PRIVATE|HYPERLINK|supervisor@example|private-access/.test(csv));assert.equal(csv.trim().split('\r\n').length,7)}))
test('export rejects a provider-capped case list before reporting totals',()=>server(async(base,_setRole,_setMode,setCaseTotal)=>{const response=await login(base);const cookie=response.headers.get('set-cookie')!.split(';')[0];setCaseTotal(1000);assert.equal((await fetch(base+'/api/supervisor/export',{headers:{Cookie:cookie}})).status,200);setCaseTotal(1001);assert.equal((await fetch(base+'/api/supervisor/export',{headers:{Cookie:cookie}})).status,413)}))
test('plain case PATCH is rejected even with a valid supervisor session',()=>server(async base=>{const response=await login(base);const cookie=response.headers.get('set-cookie')!.split(';')[0];const patch=await fetch(base+'/api/supervisor/cases',{method:'PATCH',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},body:JSON.stringify({status:'closed'})});assert.equal(patch.status,405)}))
test('workspace load fails when team records are unavailable',()=>server(async base=>{
  const response=await login(base);const cookie=response.headers.get('set-cookie')!.split(';')[0]
  const workspace=await fetch(base+'/api/supervisor/workspace',{headers:{Cookie:cookie}})
  assert.equal(workspace.status,503)
  assert(!/Patel Nagar Hand Pump/.test(await workspace.text()))
}))
test('unsupported reporting endpoints cannot return fabricated team records',()=>server(async base=>{
  const response=await login(base);const cookie=response.headers.get('set-cookie')!.split(';')[0]
  for(const path of ['metrics','test-kits','team','leaderboards/field-workers','rewards']) {
    const result=await fetch(base+'/api/supervisor/'+path,{headers:{Cookie:cookie}})
    assert.equal(result.status,405,path)
  }
}))

