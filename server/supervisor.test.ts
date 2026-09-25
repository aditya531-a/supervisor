import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { createAuthHandler } from './auth.ts'
import { readConfig } from './config.ts'
const config=readConfig({JALSAKSHI_SUPABASE_URL:'https://project.supabase.co',JALSAKSHI_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'})
const json=(value:unknown,status=200)=>Promise.resolve(new Response(JSON.stringify(value),{status}))
async function server(run:(base:string,setRole:(role:string)=>void)=>Promise<void>){
 let role='supervisor'
 const provider:typeof fetch=(url,options)=>{
  const path=String(url)
  if(path.includes('/auth/v1/token'))return json({access_token:'private-access-token',expires_in:3600,user:{id:'user-id',email:'supervisor@example.org'}})
  if(path.endsWith('/auth/v1/user'))return json({id:'user-id',email:'supervisor@example.org'})
  if(path.includes('/profiles?'))return json([{id:'user-id',team_id:'11111111-1111-1111-1111-111111111111',role}])
  if(path.includes('/teams?'))return json([{name:'Team one',data_mode:'synthetic'}])
  if(path.includes('/cases?')){
   assert.equal(new Headers(options?.headers).get('Authorization'),'Bearer private-access-token')
   assert(path.includes('team_id=eq.11111111-1111-1111-1111-111111111111'))
   return json([{id:'PRIVATE-CASE-ID',source_id:'PRIVATE-SOURCE',status:'under_review',priority:'urgent',notes:'PRIVATE OBSERVATION',name:'=HYPERLINK("evil")'}])
  }
  throw new Error('Unexpected upstream path')
 }
 const handler=createAuthHandler(config,provider)
 const http=createServer((req,res)=>handler(req,res,()=>{res.statusCode=404;res.end()}))
 http.listen(0,'127.0.0.1');await once(http,'listening');const address=http.address();assert(address&&typeof address==='object')
 try{await run(`http://127.0.0.1:${address.port}`,value=>{role=value})}finally{http.closeAllConnections();await new Promise<void>(resolve=>http.close(()=>resolve()))}
}
const login=(base:string)=>fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:'supervisor@example.org',password:'password'})})
test('workers cannot obtain a supervisor session',()=>server(async(base,setRole)=>{setRole('worker');const response=await login(base);assert.equal(response.status,403);assert.equal(response.headers.get('set-cookie'),null)}))
test('role changes invalidate access on the next authenticated request',()=>server(async(base,setRole)=>{const response=await login(base);assert.equal(response.status,200);const cookie=response.headers.get('set-cookie')!.split(';')[0];setRole('worker');const next=await fetch(base+'/api/supervisor/workspace',{headers:{Cookie:cookie}});assert.equal(next.status,403)}))
test('export uses user RLS token and excludes private values and spreadsheet formulas',()=>server(async base=>{const response=await login(base);const cookie=response.headers.get('set-cookie')!.split(';')[0];const exported=await fetch(base+'/api/supervisor/export',{headers:{Cookie:cookie}});assert.equal(exported.status,200);const csv=await exported.text();assert.match(csv,/(synthetic|live),under_review,1/);assert(!/PRIVATE|HYPERLINK|supervisor@example|private-access/.test(csv));assert.equal(csv.trim().split('\r\n').length,7)}))
test('plain case PATCH is rejected even with a valid supervisor session',()=>server(async base=>{const response=await login(base);const cookie=response.headers.get('set-cookie')!.split(';')[0];const patch=await fetch(base+'/api/supervisor/cases',{method:'PATCH',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},body:JSON.stringify({status:'closed'})});assert.equal(patch.status,405)}))
test('metrics, test-kits, team, and leaderboards endpoints return valid JSON responses',()=>server(async base=>{
  const response=await login(base);const cookie=response.headers.get('set-cookie')!.split(';')[0]
  const metrics=await (await fetch(base+'/api/supervisor/metrics',{headers:{Cookie:cookie}})).json() as {cases_open:number}
  assert(metrics.cases_open >= 1)
  const kits=await (await fetch(base+'/api/supervisor/test-kits',{headers:{Cookie:cookie}})).json() as {test_kits:unknown[]}
  assert.equal(kits.test_kits.length,4)
  const team=await (await fetch(base+'/api/supervisor/team',{headers:{Cookie:cookie}})).json() as {members:unknown[]}
  assert.equal(team.members.length,3)
  const lb=await (await fetch(base+'/api/supervisor/leaderboards/field-workers',{headers:{Cookie:cookie}})).json() as {disclaimer:string}
  assert.match(lb.disclaimer,/Points reward reporting/)
}))

