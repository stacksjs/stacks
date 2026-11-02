import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { schema } from '../../src/schema'
import { validate } from '../../src/request-validator'
import { unique, exists, validateField } from '../../src/validator'
import { getErrors } from '../../src/reporter'
import { sample } from '../../../arrays/src/helpers'
import { average, median, min, max } from '../../../arrays/src/math'

const root = await mkdtemp('/tmp/stacks-validation-contracts-')
const originalCwd = process.cwd()
const app = await mkdtemp(join(root, 'app-'))
await mkdir(join(app, 'app/Models/Sub'), {recursive:true})
await mkdir(join(app, 'storage/framework'), {recursive:true})
await symlink(join(originalCwd, 'storage/framework/defaults'), join(app,'storage/framework/defaults'), 'dir')
const schemaImport = JSON.stringify(join(originalCwd, 'storage/framework/core/validation/src/schema.ts'))
const model = (attributes: string) => `import {schema} from ${schemaImport}; export default {attributes:${attributes}}`
await writeFile(join(app, 'app/Models/AuditDefault.ts'), model("{status:{default:'draft',validation:{rule:schema.enum(['draft','published'])}}}"))
await writeFile(join(app, 'app/Models/Sub/AuditNested.ts'), model("{name:{validation:{rule:schema.string().required()}}}"))
await writeFile(join(app, 'app/Models/NotAuditTarget.ts'), model("{name:{validation:{rule:schema.string().required()}}}"))
await writeFile(join(app, 'app/Models/AuditReport.ts'), model("{email:{validation:{rule:schema.string().required().email()}}}"))
process.chdir(app)
const findings: Array<{id:number,name:string,observed:string}> = []
async function probe(id:number,name:string,run:()=>unknown|Promise<unknown>) {
 try {await run();console.log(`PASS ${id}: ${name}`)}
 catch(error){const observed=String(error);findings.push({id,name,observed});console.log(`FAIL ${id}: ${name}\n${observed.slice(0,700)}`)}
}
async function errors(run:()=>Promise<unknown>):Promise<any>{try{await run();return null}catch(error){return (error as any).details?.errors ?? {status:(error as any).status,message:String(error)}}}
let customCalls = 0
const server = Bun.serve({port:0,hostname:'127.0.0.1',async fetch(request){
 const url=new URL(request.url)
 try {
  if(url.pathname==='/native') return Response.json(await validate(request,{name:schema.string().required()}))
  if(url.pathname==='/clean') return Response.json(await validate({jsonBody:await request.json()},{name:schema.string().required()}))
  if(url.pathname==='/proto') {
    const result=await validate({jsonBody:await request.json()},{isAdmin:schema.boolean().required()})
    return Response.json({own:Object.hasOwn(result,'isAdmin'),value:result.isAdmin})
  }
  if(url.pathname==='/conditional') return Response.json(await validate({jsonBody:await request.json()},{country:schema.string(),token:{rule:schema.string().when('country','DE',rule=>rule.required()),message:{required:'Need a token'}}}))
  if(url.pathname==='/nested-message') return Response.json(await validate({jsonBody:await request.json()},{profile:{rule:schema.object({email:schema.string().required().email()}),message:'Profile invalid'}}))
  if(url.pathname==='/custom') return Response.json(await validate({jsonBody:await request.json()},{name:{rule:schema.string().custom(()=>{customCalls++;return false},'Default custom error'),message:{custom:'Custom error'}}}))
  if(url.pathname.startsWith('/report/')){
   const id=url.pathname.split('/').at(-1)
   try{await validateField('AuditReport',{email:`${id}-invalid-email`})}catch{}
   if(id==='A')await Bun.sleep(70)
   return Response.json({errors:getErrors()})
  }
  if(url.pathname==='/statistics')return Response.json({average:average([1e308,1e308]),median:median([1e308,1e308])})
  if(url.pathname==='/large-statistics'){const data=Array.from({length:250000},(_,index)=>index);return Response.json({min:min(data),max:max(data)})}
  return new Response('missing',{status:404})
 }catch(error){return Response.json({message:String(error),errors:(error as any).details?.errors},{status:(error as any).status??500})}
}})
const base=`http://127.0.0.1:${server.port}`
const post=async(path:string,data:unknown)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)})
try{
 await probe(1,'validate returns unvalidated extra fields as cleaned output',async()=>{
  const response=await post('/clean',{name:'Alice',isAdmin:true});assert.deepEqual(await response.json(),{name:'Alice'})
 })
 await probe(2,'plain business records with a url field are misclassified as request wrappers',async()=>{
  assert.deepEqual(await validate({name:'Alice',url:'https://example.test/profile?from=example'}, {name:schema.string().required(),url:schema.string().required()}),{name:'Alice',url:'https://example.test/profile?from=example'})
 })
 await probe(3,'native HTTP Request JSON bodies are ignored',async()=>{
  const response=await post('/native',{name:'Alice'});assert.equal(response.status,200,JSON.stringify(await response.json()))
 })
 await probe(4,'request JSON __proto__ changes the merged input prototype and satisfies a missing required field',async()=>{
  const response=await post('/proto',JSON.parse('{"__proto__":{"isAdmin":true}}'));assert.equal(response.status,422,JSON.stringify(await response.json()))
 })
 await probe(5,'schema.object accepts inherited values as required submitted fields',()=>{
  assert.equal(schema.object({token:schema.string().required()}).validate(Object.create({token:'not-submitted'})).valid,false)
 })
 await probe(6,'a declared __proto__ field silently bypasses its validation rule',async()=>{
  const rules=Object.fromEntries([['__proto__',schema.string().required().min(3)]])
  const result=await errors(()=>validate({jsonBody:JSON.parse('{"__proto__":"x"}')},rules))
  assert(result,'Invalid own __proto__ field was accepted')
 })
 await probe(7,'model default values disable validation even when invalid data is explicitly supplied',async()=>{
  const result=await errors(()=>validateField('AuditDefault',{status:'invalid'}));assert(result,'Invalid enum passed because the model has a default')
 })
 await probe(8,'nested application models cannot be discovered by validateField',async()=>{
  const result=await validateField('AuditNested',{name:'Alice'});assert.equal(result.valid,true)
 })
 await probe(9,'model discovery accepts suffix matches for a different model',async()=>{
  const result=await errors(()=>validateField('AuditTarget',{name:'Alice'}));assert.equal(result?.status,404,'NotAuditTarget was used for nonexistent AuditTarget')
 })
 await probe(10,'database-backed exists and unique approve data when the database query fails',async()=>{
  const results:unknown[]=[]
  for(const rule of[unique('__audit_missing_table__','email'),exists('__audit_missing_table__','email')]){
   try{results.push(await rule('synthetic@example.test',{}))}catch{results.push('error')}
  }
  assert.equal(results.includes(true),false,`Missing table checks returned ${JSON.stringify(results)}`)
 })
 await probe(11,'custom message mapping executes validation predicates a second time',async()=>{
  customCalls=0;const response=await post('/custom',{name:'Alice'});assert.equal(response.status,422);assert.equal(customCalls,1)
 })
 await probe(12,'conditional required failures lose their configured custom message',async()=>{
  const response=await post('/conditional',{country:'DE'});const result=await response.json();assert.deepEqual(result.errors.token,['Need a token'])
 })
 await probe(13,'field-wide custom messages are ignored for nested object failures',async()=>{
  const response=await post('/nested-message',{profile:{email:'invalid'}});const result=await response.json();assert.deepEqual(result.errors['profile.email'],['Profile invalid'])
 })
 await probe(14,'the global validation reporter exchanges error values between overlapping HTTP requests',async()=>{
  const a=fetch(base+'/report/A');await Bun.sleep(15);await fetch(base+'/report/B');const result=await(await a).json();assert.equal(result.errors[0].value,'A-invalid-email')
 })
 await probe(15,'timestamp validation accepts impossible calendar dates',()=>{
  assert.equal(schema.timestamp().validate('2026-02-30T12:00:00Z').valid,false)
 })
 await probe(16,'a NaN file-size bound silently disables the configured upload limit',()=>{
  class Upload{size=1000000;mimeType='image/png';name='image.png'}
  assert.throws(()=>schema.file().maxBytes(Number('invalid-config')).validate(new Upload()),/./)
 })
 await probe(17,'sample of an empty array fabricates undefined elements',()=>{
  assert.deepEqual(sample([],3),[])
 })
 await probe(19,'finite statistical inputs overflow to Infinity and serialize as null',async()=>{
  const result=await(await fetch(base+'/statistics')).json();assert.deepEqual(result,{average:1e308,median:1e308})
 })

 await probe(21,'validated output strips nested objects and array elements without testing twice',async()=>{
  let visits=0
  const child=schema.object({name:schema.string().required().custom(()=>{visits++;return true},'unused')})
  const input={profile:{name:'Alice',isAdmin:true},items:[{name:'Bob',isAdmin:true}],matrix:[[{name:'Carol',isAdmin:true}]],extra:true}
  const result=await validate(input,{profile:child,items:schema.array().each(child),matrix:schema.array().each(schema.array().each(child))})
  assert.deepEqual(result,{profile:{name:'Alice'},items:[{name:'Bob'}],matrix:[[{name:'Carol'}]]})
  assert.equal(visits,3)
  assert.equal(input.profile.isAdmin,true)
 })
 await probe(22,'request source modes preserve business metadata and explicit adapter precedence',async()=>{
  const business={url:'https://example.test/?q=x',query:{name:'business'},jsonBody:{name:'payload'}}
  assert.deepEqual(await validate(business,{url:schema.string(),query:schema.object({name:schema.string()}),jsonBody:schema.object({name:schema.string()})},{source:'data'}),business)
  assert.deepEqual(await validate({url:'http://example.test/?name=url',query:{name:'query'},jsonBody:{name:'body'},params:{name:'path'}},{name:schema.string().required()},{source:'request'}),{name:'path'})
  assert.deepEqual(await validate({all:()=>Promise.resolve({name:'Alice',extra:true})},{name:schema.string().required()}),{name:'Alice'})
  const invalid=await fetch(base+'/native',{method:'POST',headers:{'content-type':'application/json'},body:'{'})
  assert.equal(invalid.status,422)
  for(const input of[[],{all:()=>null},{all:()=>[]},{all:()=>42}]){
   const invalidInput=await errors(()=>validate(input as never,{name:schema.string().required()}))
   assert.equal(invalidInput.status,422)
  }
  assert.equal((await post('/native',[])).status,422)
 })
 await probe(23,'special field names retain values and errors without changing prototypes',async()=>{
  for(const field of['__proto__','constructor','toString']){
   const rules=Object.fromEntries([[field,schema.string().required().min(3)]])
   const valid=await validate({jsonBody:Object.fromEntries([[field,'valid']])},rules)
   assert(Object.hasOwn(valid,field));assert.equal(Object.getPrototypeOf(valid),Object.prototype)
   const invalid=await errors(()=>validate({jsonBody:Object.fromEntries([[field,'x']])},rules))
   assert(Object.hasOwn(invalid,field))
  }
  const conditional=schema.object({flag:schema.boolean(),token:schema.string().when('flag',true,rule=>rule.required())})
  assert.equal(conditional.validate(Object.create({flag:true})).valid,true)
 })
 await probe(24,'frozen reusable schemas preserve custom messages and single predicate execution',async()=>{
  let calls=0
  const rule=schema.string().custom(()=>{calls++;return false},'original')
  for(const entry of rule.getRules())Object.freeze(entry)
  Object.freeze(rule.getRules());Object.freeze(rule)
  const result=await errors(()=>validate({name:'Alice'},{name:{rule,message:{custom:'Configured'}}}))
  assert.deepEqual(result,{name:['Configured']});assert.equal(calls,1)
 })
 await probe(25,'successful validations reset reports and error snapshots cannot mutate the report',async()=>{
  await errors(()=>validateField('AuditReport',{email:'invalid'}))
  const snapshot=getErrors();assert.equal(snapshot.length,1);snapshot[0]!.value='changed'
  assert.equal(getErrors()[0]!.value,'invalid')
  await validateField('AuditReport',{email:'valid@example.test'});assert.deepEqual(getErrors(),[])
 })
 await probe(26,'defaulted fields validate snake and camel aliases and absent defaults stay optional',async()=>{
  await writeFile(join(app,'app/Models/AuditAliases.ts'),model("{itemCount:{default:0,validation:{rule:schema.number().min(0)}}}"))
  assert.equal((await validateField('AuditAliases',{})).valid,true)
  assert(await errors(()=>validateField('AuditAliases',{item_count:-1})))
  assert(await errors(()=>validateField('AuditAliases',{itemCount:-1})))
  assert(await errors(()=>validateField('AuditAliases',{item_count:1,itemCount:-1})))
  assert.equal((await validateField('AuditAliases',{item_count:-1,itemCount:1})).valid,true)
  assert.equal((await validateField('Sub/AuditNested',{name:'Alice'})).valid,true)
  assert.equal((await errors(()=>validateField('../AuditReport',{}))).status,404)
 })
 await probe(27,'timestamp calendar checks retain ISO offsets, minute precision and expanded years',()=>{
  for(const value of['2024-02-29T12:30Z','2026-12-31T23:59:59-02:00','2026-12-31 23:59:59.123','2026-12-31T24:00:00Z',new Date(8640000000000000).toISOString()])assert.equal(schema.timestamp().validate(value).valid,true,value)
  for(const value of['2026-02-29T12:00:00Z','2026-04-31 12:00:00','2026-01-01T24:00:01Z','2026-01-01T12:60:00Z'])assert.equal(schema.timestamp().validate(value).valid,false,value)
  for(const bound of[NaN,Infinity,-1,1.5]){assert.throws(()=>schema.file().maxBytes(bound));assert.throws(()=>schema.file().minBytes(bound))}
 })

}finally{server.stop(true);process.chdir(originalCwd);await rm(root,{recursive:true,force:true})}
assert.deepEqual(findings,[], 'Boundary contract failures');console.log('validation boundary contracts OK')
