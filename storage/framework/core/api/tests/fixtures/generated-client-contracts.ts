import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { renderApiClient } from '../../src/generate-client'
import { renderOpenApiTypes } from '../../src/generate-types'

const root = await mkdtemp(join(tmpdir(), 'stacks-generated-client-contracts-'))
const tsc = resolve(import.meta.dir, '../../../../../../node_modules/.bin/tsc')
const findings: Array<{ id: number, name: string, observed: string, artifact?: string }> = []
const common = { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } } }
const param = (name: string, location = 'query', schema: unknown = { type: 'string' }) => ({ name, in: location, required: true, schema })
const op = (operationId: string, extra: object = {}) => ({ operationId, responses: common, ...extra })
const doc = (paths: object, components?: object): any => ({ openapi: '3.0.3', info: { title: 'Audit', version: '1' }, paths, ...(components ? { components } : {}) })

async function probe(id: number, name: string, run: () => Promise<void>) {
  try { await run(); console.log(`PASS ${id}: ${name}`) }
  catch (error) {
    const observed = String(error)
    findings.push({ id, name, observed })
    console.log(`FAIL ${id}: ${name}\n${observed.slice(0, 500)}`)
  }
}
async function generate(document: any, name = 'client', options?: {name?: string}) {
  const directory = await mkdtemp(join(root, `${name}-`))
  const file = join(directory, 'client.ts')
  const source = renderApiClient(document, options)
  await writeFile(file, source)
  return { module: await import(file), source, directory, file }
}
async function compile(source: string, name: string, consumer = '') {
  const directory = await mkdtemp(join(root, `types-${name}-`))
  const file = join(directory, 'client.ts')
  await writeFile(file, source)
  const entry = join(directory, 'consumer.ts')
  await writeFile(entry, consumer || 'import "./client"\n')
  const result = Bun.spawnSync([tsc, '--noEmit', '--strict', '--skipLibCheck', '--lib', 'esnext,dom', '--moduleResolution', 'bundler', '--module', 'esnext', '--target', 'esnext', entry], { cwd: directory, stdout: 'pipe', stderr: 'pipe' })
  return { code: result.exitCode, output: result.stdout.toString() + result.stderr.toString(), file }
}
const server = Bun.serve({ port: 0, hostname: '127.0.0.1', async fetch(request) {
  const url = new URL(request.url)
  if (url.pathname === '/multipart') {
    const form = await request.formData()
    const file = form.get('upload') as File
    return Response.json({name:file.name, type:file.type, text:await file.text(), caption:form.get('caption')})
  }
  if (url.pathname === '/binary') return new Response(await request.arrayBuffer(), {headers:{'content-type':'application/pdf'}})
  if (url.pathname === '/empty-text') return new Response('', {headers:{'content-type':'text/plain'}})
  if (url.pathname === '/no-content') return new Response(null, {status:204})

  if (url.pathname === '/text') return new Response('123', { headers: { 'content-type': 'text/plain' } })
  if (url.pathname === '/multiple') return Response.json(123, { status: 201 })
  if (url.pathname === '/header' && !request.headers.has('x-tenant')) return Response.json({ error: 'Missing required tenant header' }, { status: 400 })
  return Response.json({ path: url.pathname, query: [...url.searchParams], header: request.headers.get('x-tenant'), labels: request.headers.get('x-labels'), contentType: request.headers.get('content-type'), body: await request.text() })
} })
const baseUrl = `http://127.0.0.1:${server.port}`
try {
  await probe(1, 'normalized operation names collide with generated suffixes and drop an endpoint', async () => {
    const { module } = await generate(doc({ '/a': { get: op('foo-bar') }, '/b': { get: op('foo_bar') }, '/c': { get: op('fooBar2') } }))
    const client = module.createClient({ baseUrl })
    const paths = await Promise.all(Object.values(client).filter(value => typeof value === 'function').map(async (call: any) => (await call()).data.path))
    assert.deepEqual(paths.sort(), ['/a', '/b', '/c'])
  })
  await probe(2, 'operation named config overwrites the public client configuration', async () => {
    const { module } = await generate(doc({ '/config': { get: op('config') } }))
    assert.equal(typeof module.createClient({ baseUrl }).config, 'object')
  })
  await probe(3, 'an operation summary can escape its generated comment and execute code', async () => {
    const key = '__STACKS_SYNTHETIC_AUDIT_FLAG__'
    const { module } = await generate(doc({ '/injection': { get: op('injection', { summary: `harmless */\n auditFlag: (globalThis.${key} = true),\n /*` }) } }))
    module.createClient({ baseUrl })
    assert.equal((globalThis as any)[key], undefined)
    const title = await generate(doc({}), 'title', {name:`description */\nglobalThis.${key} = true\n/*`})
    title.module.createClient({baseUrl})
    assert.equal((globalThis as any)[key], undefined)
  })
  await probe(4, 'component schema references become unknown in generated client responses', async () => {
    const document = doc({ '/refs': { get: op('refs', { responses: { 200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } } } }) } }, { schemas: { User: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } } })
    const compiled = await compile(renderApiClient(document), 'refs', 'import {createClient} from "./client"; const result = await createClient({baseUrl:"http://example.test"}).refs(); if (result.ok) result.data.id.toUpperCase()')
    assert.equal(compiled.code, 0, compiled.output)
  })
  await probe(5, 'nullable model fields reject their valid null values in generated types', async () => {
    const source = renderOpenApiTypes(doc({}, { schemas: { DeletedAt: { type: 'string', format: 'date-time', nullable: true } } }))
    const compiled = await compile(source, 'nullable', 'import type {components} from "./client"; const deleted: components["schemas"]["DeletedAt"] = null')
    assert.equal(compiled.code, 0, compiled.output)
  })
  await probe(6, 'oneOf composition becomes unknown and accepts values outside every variant', async () => {
    const source = renderOpenApiTypes(doc({}, { schemas: { Choice: { oneOf: [{ type: 'string' }, { type: 'number' }] } } }))
    const compiled = await compile(source, 'oneof', 'import type {components} from "./client"; const invalid: components["schemas"]["Choice"] = true')
    assert.notEqual(compiled.code, 0, 'TypeScript accepted boolean for a string-or-number schema')
    assert.match(compiled.output, /TS2322/)
  })
  await probe(7, 'properties with differently typed additionalProperties generate uncompilable types', async () => {
    const source = renderOpenApiTypes(doc({}, { schemas: { Metric: { type: 'object', required: ['name'], properties: { name: { type: 'string' } }, additionalProperties: { type: 'number' } } } }))
    const compiled = await compile(source, 'additional')
    assert.equal(compiled.code, 0, compiled.output)
  })
  await probe(8, 'object-valued enum literals generate invalid TypeScript syntax', async () => {
    const source = renderOpenApiTypes(doc({}, { schemas: { State: { type: 'object', enum: [{ state: 'ready' }, { state: 'done' }] } } }))
    const compiled = await compile(source, 'enum')
    assert.equal(compiled.code, 0, compiled.output)
  })
  await probe(9, 'required header parameters disappear from the generated method signature and request', async () => {
    const { module, source } = await generate(doc({ '/header': { get: op('header', { parameters: [param('X-Tenant', 'header')] }) } }))
    const result = await module.createClient({ baseUrl }).header({ headers: { 'X-Tenant': 'tenant-A' } })
    assert.equal(result.status, 200)
    assert.equal((await module.createClient({baseUrl}).header({headers:{'x-tenant':'tenant-A'}})).status, 200)
    const missing = await compile(source, 'required-header', 'import {createClient} from "./client"; createClient({baseUrl:"http://example.test"}).header()')
    assert.notEqual(missing.code, 0)
    assert.match(missing.output, /TS2554/)
  })
  await probe(10, 'path-item parameters are ignored instead of inherited by operations', async () => {
    const { module } = await generate(doc({ '/inherited/{id}': { parameters: [param('id', 'path')], get: op('inherited') } }))
    assert.equal((await module.createClient({ baseUrl }).inherited({ id: 'alice' })).data.path, '/inherited/alice')
  })
  await probe(11, 'hyphenated path-parameter names are left as literal braces in the URL', async () => {
    const { module } = await generate(doc({ '/hyphen/{user-id}': { get: op('hyphen', { parameters: [param('user-id', 'path')] }) } }))
    assert.equal((await module.createClient({ baseUrl }).hyphen({ 'user-id': 'alice' })).data.path, '/hyphen/alice')
  })
  await probe(12, 'dot-only parameter values silently change the target endpoint', async () => {
    const { module } = await generate(doc({ '/safe/{id}/edit': { post: op('dot', { parameters: [param('id', 'path')] }) } }))
    // Rejecting this input before transport is safe. Sending a POST to /edit is not.
    let result
    try { result = await module.createClient({ baseUrl }).dot({ id: '..' }) }
    catch { return }
    assert.equal(result.data.path.startsWith('/safe/'), true, `POST was sent to ${result.data.path}`)
  })
  await probe(13, 'default form/explode query arrays are collapsed into one comma-delimited value', async () => {
    const { module } = await generate(doc({ '/arrays': { get: op('arrays', { parameters: [param('tag', 'query', { type: 'array', items: { type: 'string' } })] }) } }))
    assert.deepEqual((await module.createClient({ baseUrl }).arrays({ tag: ['a', 'b'] })).data.query, [['tag', 'a'], ['tag', 'b']])
  })
  await probe(14, 'deepObject query filters are sent as the literal string [object Object]', async () => {
    const { module } = await generate(doc({ '/filters': { get: op('filters', { parameters: [{ ...param('filter', 'query', { type: 'object', properties: { name: { type: 'string' } } }), style: 'deepObject', explode: true }] }) } }))
    assert.deepEqual((await module.createClient({ baseUrl }).filters({ filter: { name: 'Alice' } })).data.query, [['filter[name]', 'Alice']])
  })
  await probe(15, 'equal parameter names in different locations generate duplicate incompatible fields', async () => {
    const source = renderApiClient(doc({ '/same/{id}': { get: op('same', { parameters: [param('id', 'path'), param('id', 'query', { type: 'integer' })] }) } }))
    const compiled = await compile(source, 'locations')
    assert.equal(compiled.code, 0, compiled.output)
    const { module } = await generate(doc({ '/same/{id}': { get: op('same', { parameters: [param('id', 'path'), param('id', 'query', { type: 'integer' })] }) } }))
    const response = await module.createClient({ baseUrl }).same({ path: { id: 'alice' }, query: { id: 7 } })
    assert.equal(response.data.path, '/same/alice')
    assert.deepEqual(response.data.query, [['id', '7']])
  })
  await probe(16, 'non-JSON request bodies are omitted even when the schema marks them required', async () => {
    const { module } = await generate(doc({ '/form': { post: op('form', { requestBody: { required: true, content: { 'application/x-www-form-urlencoded': { schema: { type: 'object', properties: { name: { type: 'string' } } } } } } }) } }))
    assert.equal((await module.createClient({ baseUrl }).form({ body: { name: 'Alice' } })).data.body, 'name=Alice')
  })
  await probe(17, 'JSON-looking text/plain bodies violate their promised string response type', async () => {
    const { module } = await generate(doc({ '/text': { get: op('text', { responses: { 200: { description: 'Text', content: { 'text/plain': { schema: { type: 'string' } } } } } }) } }))
    assert.equal((await module.createClient({ baseUrl }).text()).data, '123')
  })
  await probe(18, 'multiple successful response schemas are narrowed to the first 2xx only', async () => {
    const document = doc({ '/multiple': { get: op('multiple', { responses: { 200: { description: 'String', content: { 'application/json': { schema: { type: 'string' } } } }, 201: { description: 'Number', content: { 'application/json': { schema: { type: 'number' } } } } } }) } })
    const { module, source } = await generate(document)
    const result = await module.createClient({ baseUrl }).multiple()
    assert.equal(result.status, 201)
    const compiled = await compile(source, 'successes', 'import {createClient} from "./client"; const result = await createClient({baseUrl:"http://example.test"}).multiple(); if (result.ok && typeof result.data === "number") result.data.toFixed()')
    assert.equal(compiled.code, 0, compiled.output)
  })
  await probe(19, 'case-variant headers combine into an invalid content-type instead of replacing defaults', async () => {
    const { module } = await generate(doc({ '/headers': { post: op('headers', { requestBody: { content: { 'application/json': { schema: { type: 'object' } } } } }) } }))
    const result = await module.createClient({ baseUrl, headers: { 'content-type': 'application/json' } }).headers({ body: {} })
    assert.equal(result.data.contentType, 'application/json')
  })
  await probe(20, 'readOnly request fields are wrongly required in generated request body types', async () => {
    const source = renderApiClient(doc({ '/readonly': { post: op('create', { requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['id', 'name'], properties: { id: { type: 'integer', readOnly: true }, name: { type: 'string' } } } } } } }) } }))
    const compiled = await compile(source, 'readonly', 'import type {Client} from "./client"; const valid: Parameters<Client["create"]>[0] = { body: { name:"Alice" } }')
    assert.equal(compiled.code, 0, compiled.output)
  })
  await probe(21, 'recursive refs, escaped names, composition and directional properties compile for consumers', async () => {
    const document = doc({}, { schemas: {
      User: { type: 'object', required: ['id', 'password'], properties: { id: { type: 'integer', readOnly: true }, password: { type: 'string', writeOnly: true }, parent: { $ref: '#/components/schemas/User' } } },
      Alias: { $ref: '#/components/schemas/User' },
      Envelope: {type:'object', properties:{id:{type:'string'}}},
      Nested: {$ref:'#/components/schemas/Envelope/properties/id'},
      'a/b~c': { type: 'string' },
      Escaped: { $ref: '#/components/schemas/a~1b~0c' },
      Both: { allOf: [{ type: 'object', required: ['a'], properties: { a: { type: 'string' } } }, { type: 'object', required: ['b'], properties: { b: { type: 'number' } } }] },
      Choice: { anyOf: [{ type: 'string' }, { type: 'number' }] },
      Enum: { enum: [{ state: 'ready' }, [1, true, null]] },
      Metrics: { type: 'object', properties: { name: { type: 'string' } }, additionalProperties: { type: 'number' } },
    } })
    const compiled = await compile(renderOpenApiTypes(document), 'schema-edges', `
      import type { components } from './client'
      const response: components['schemas']['Alias'] = {id: 1, parent: {id: 2}}
      const request: components['requestSchemas']['User'] = {password: 'synthetic'}
      const nested: components['schemas']['Nested'] = 'kept'
      const escaped: components['schemas']['Escaped'] = 'kept'
      const both: components['schemas']['Both'] = {a: 'value', b: 1}
      const choice: components['schemas']['Choice'] = 1
      const enumObject: components['schemas']['Enum'] = {state:'ready'}
      const enumArray: components['schemas']['Enum'] = [1, true, null]
      const metrics: components['schemas']['Metrics'] = {count: 1}
      // @ts-expect-error write-only properties are absent from responses
      response.password
      // @ts-expect-error read-only properties are absent from requests
      request.id
      // @ts-expect-error intersections require both fields
      const invalidBoth: components['schemas']['Both'] = {a:'value'}
      // @ts-expect-error union members remain constrained
      const invalidChoice: components['schemas']['Choice'] = true
      // @ts-expect-error enum tuples retain literal values
      const invalidEnum: components['schemas']['Enum'] = [2, true, null]
    `)
    assert.equal(compiled.code, 0, compiled.output)
    assert.throws(() => renderOpenApiTypes(doc({}, { schemas: { A: { $ref: '#/components/schemas/Missing' } } })), /Missing/)
    assert.throws(() => renderOpenApiTypes(doc({}, { schemas: { A: { $ref: '#/components/schemas/B' }, B: { $ref: '#/components/schemas/A' } } })), /cyclic/)
    assert.throws(() => renderOpenApiTypes(doc({}, { schemas: { A: { $ref: 'https://example.test/schema' } } })), /Unsupported/)
    const cycle: Record<string, unknown> = { type: 'object' }; cycle.properties = { self: cycle }
    assert.throws(() => renderOpenApiTypes(doc({}, { schemas: { A: cycle } })), /Recursive/)
  })
  await probe(22, 'inherited overrides, body-name collisions and alternate media remain correct over HTTP', async () => {
    const json = { schema: { type: 'object' } }
    const document = doc({
      '/names': {get:op('names', {parameters:['path','query','body','headers'].map(name=>param(name))})},
      '/override/{id}': { parameters: [param('id', 'path'), param('page', 'query')], get: op('override', { parameters: [{ ...param('page', 'query'), required: false }] }) },
      '/body': { post: op('bodyCollision', { parameters: [param('body')], requestBody: { required: true, content: { 'application/json': json } } }) },
      '/alternate': { post: op('alternate', { requestBody: { required: true, content: { 'application/json': json, 'application/x-www-form-urlencoded': json } } }) },
      '/multipart': { post: op('multipart', { requestBody: { required: true, content: { 'multipart/form-data': json } } }) },
      '/binary': { post: op('binary', { requestBody: { required: true, content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } }, responses: {200: {content: {'Application/PDF; version=1': {schema: {$ref:'#/components/schemas/File'}}}}} }) },
      '/plain': { post: op('plain', { requestBody: { required: true, content: { 'text/plain': {schema: {type:'string'}} } } }) },
      '/styles/{ids}/{point}': {get:op('styles', {parameters:[
        param('ids','path',{type:'array',items:{type:'string'}}),
        {...param('point','path',{type:'object'}),explode:true},
        {...param('X-Labels','header',{type:'object'}),explode:true},
        {...param('tags','query',{type:'array',items:{type:'string'}}),style:'pipeDelimited'},
        {...param('words','query',{type:'array',items:{type:'string'}}),style:'spaceDelimited'},
        {...param('csv','query',{type:'array',items:{type:'string'}}),style:'form',explode:false},
        {...param('attrs','query',{type:'object'}),style:'form',explode:true},
      ]})},
      '/empty-text': {get:op('emptyText', {responses:{200:{content:{'text/plain':{schema:{type:'string'}}}}}})},
      '/head': { head: op('head') },
      '/no-content': { delete: op('remove', {responses: {204: {description:'No content'}}}) },
    })
    document.components = {schemas:{File:{type:'string',format:'binary',nullable:true}}}
    const { module, source } = await generate(document)
    const compiled = await compile(source, 'wire-edges', `
      import { createClient } from './client'
      const client = createClient({baseUrl:'http://example.test'})
      client.names({path:'src',query:'term',body:'value',headers:'label'})
      client.override({id:'alice'})
      client.bodyCollision({query:{body:'filter'}, body:{name:'Alice'}})
      client.multipart({body:{upload:new Blob(['bytes'])}})
      client.binary({body:new Blob(['bytes'])})
      // @ts-expect-error headers are not a substitute for the required body
      client.binary({})
    `)
    assert.equal(compiled.code, 0, compiled.output)
    const client = module.createClient({ baseUrl })
    assert.deepEqual((await client.names({path:'src',query:'term',body:'value',headers:'label'})).data.query, [['path','src'],['query','term'],['body','value'],['headers','label']])
    assert.deepEqual((await client.override({id:'alice'})).data.query, [])
    const collision = await client.bodyCollision({query:{body:'filter'}, body:{name:'Alice'}})
    assert.deepEqual(collision.data.query, [['body','filter']])
    assert.equal(collision.data.body, '{"name":"Alice"}')
    assert.equal((await client.alternate({body:{name:'a & b', tags:['x','y']}}, {contentType:'application/x-www-form-urlencoded'})).data.body, 'name=a+%26+b&tags=x&tags=y')
    const file = new File(['actual bytes'], 'proof.txt', {type:'text/plain'})
    const multipart = await client.multipart({body:{upload:file, caption:'kept'}})
    assert.equal(multipart.data.type.split(';')[0], 'text/plain')
    assert.deepEqual({name:multipart.data.name, text:multipart.data.text, caption:multipart.data.caption}, {name:'proof.txt', text:'actual bytes', caption:'kept'})
    const bytes = new Uint8Array([255, 0, 128, 1])
    const binary = await client.binary({body:new Blob([bytes])})
    assert(binary.data instanceof Blob)
    assert.deepEqual(new Uint8Array(await binary.data.arrayBuffer()), bytes)
    assert.equal((await client.plain({body:'actual text'})).data.body, 'actual text')
    const styles = await client.styles({ids:['a/b','c d'],point:{x:1,y:2},headers:{'X-Labels':{name:'kept',flag:true}},tags:['x','y'],words:['two','words'],csv:['x','y'],attrs:{a:1,b:2}})
    assert.equal(styles.data.path, '/styles/a%2Fb,c%20d/x=1,y=2')
    assert.equal(styles.data.labels, 'name=kept,flag=true')
    assert.deepEqual(styles.data.query, [['tags','x|y'],['words','two words'],['csv','x,y'],['a','1'],['b','2']])
    assert.equal((await client.emptyText()).data, '')
    assert.equal((await client.head()).data, null)
    assert.equal((await client.remove()).data, null)
    await assert.rejects(() => client.alternate({body:{}}, {contentType:'application/xml'}), /media type/)
    await assert.rejects(() => client.override({id:'.'}), /Dot-only/)
    await assert.rejects(() => client.override({}), /Missing required/)
  })

}
finally { server.stop(true); await rm(root, { recursive: true, force: true }) }

assert.deepEqual(findings, [], 'Generated client contract failures')
console.log('20 generated client contracts OK')
