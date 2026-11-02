import assert from 'node:assert/strict'
import { renderApiClient } from '../../src/generate-client'
import { launch, waitFor } from '@stacksjs/testing/browser'

const op = (operationId: string, extra: object = {}) => ({ operationId, responses: { 200: { content: { 'application/json': { schema: { type: 'object' } } } } }, ...extra })
const parameter = (name: string, location = 'query', schema: unknown = { type: 'string' }) => ({ name, in: location, required: true, schema })
const document: any = { components:{schemas:{File:{type:'string',format:'binary',nullable:true}}}, paths: {
  '/a': { get: op('foo-bar') }, '/b': { get: op('foo_bar') }, '/c': { get: op('fooBar2') },
  '/config': { get: op('config') },
  '/injection': { get: op('injection', { summary: 'description */\n auditFlag: (globalThis.__SYNTHETIC_CLIENT_AUDIT_FLAG__ = true),\n /*' }) },
  '/header': { get: op('header', { parameters: [parameter('X-Tenant', 'header')] }) },
  '/inherited/{id}': { parameters: [parameter('id', 'path')], get: op('inherited') },
  '/hyphen/{user-id}': { get: op('hyphen', { parameters: [parameter('user-id', 'path')] }) },
  '/safe/{id}/edit': { post: op('dot', { parameters: [parameter('id', 'path')] }) },
  '/arrays': { get: op('arrays', { parameters: [parameter('tag', 'query', { type: 'array', items: { type: 'string' } })] }) },
  '/filters': { get: op('filters', { parameters: [{ ...parameter('filter', 'query', { type: 'object', properties: { name: { type: 'string' } } }), style: 'deepObject', explode: true }] }) },
  '/form': { post: op('form', { requestBody: { required: true, content: { 'application/x-www-form-urlencoded': { schema: { type: 'object' } } } } }) },
  '/headers': { post: op('headers', { requestBody: { content: { 'application/json': { schema: { type: 'object' } } } } }) },
  '/binary': {post:op('binary',{requestBody:{required:true,content:{'application/octet-stream':{schema:{type:'string',format:'binary'}}}},responses:{200:{content:{'Application/PDF; version=1':{schema:{$ref:'#/components/schemas/File'}}}}}})},
  '/multipart': {post:op('multipart',{requestBody:{required:true,content:{'multipart/form-data':{schema:{type:'object'}}}}})},
  '/text': { get: op('text', { responses: { 200: { content: { 'text/plain': { schema: { type: 'string' } } } } } }) },
} }
const source = renderApiClient(document)
const transpiled = new Bun.Transpiler({ loader: 'ts', target: 'browser' }).transformSync(source)
const html = `<!doctype html><html><body><script type="module">
import { createClient } from '/client.js';
const client = createClient({ baseUrl: location.origin });
let dotRejected = false;
try { await client.dot({id:'..'}) } catch { dotRejected = true }
const binary = await client.binary({body:new Blob([new Uint8Array([255,0,128,1])])});
const multipart = await client.multipart({body:{upload:new File(['actual bytes'],'proof.txt',{type:'text/plain'}),caption:'kept'}});
const results = {
  binaryBytes: Array.from(new Uint8Array(await binary.data.arrayBuffer())),
  multipart: multipart.data,
  collisionPaths: await Promise.all([client.fooBar(), client.fooBar3(), client.fooBar2()].map(async result => (await result).data.path)),
  reservedOperation: (await client.config2()).data.path,
  configType: typeof client.config,
  injected: Boolean(globalThis.__SYNTHETIC_CLIENT_AUDIT_FLAG__),
  missingHeader: (await client.header({headers:{'X-Tenant':'tenant-A'}})).status,
  inheritedPath: (await client.inherited({id:'alice'})).data.path,
  hyphenatedPath: (await client.hyphen({'user-id':'alice'})).data.path,
  dotRejected,
  arrayQuery: (await client.arrays({tag:['a','b']})).data.query,
  objectQuery: (await client.filters({filter:{name:'Alice'}})).data.query,
  omittedFormBody: (await client.form({body:{name:'Alice'}})).data.body,
  combinedContentType: (await client.headers({body:{}}, {headers:{'content-type':'application/json'}})).data.contentType,
  textValue: (await client.text()).data,
};
const pre = document.createElement('pre'); pre.textContent = JSON.stringify(results); document.body.append(pre);
</script></body></html>`
const server = Bun.serve({ port: 0, hostname: '127.0.0.1', async fetch(request) {
  const url = new URL(request.url)
  if (url.pathname === '/') return new Response(html, { headers: { 'content-type': 'text/html' } })
  if (url.pathname === '/client.js') return new Response(transpiled, { headers: { 'content-type': 'application/javascript' } })
  if (url.pathname === '/binary') return new Response(await request.arrayBuffer(), {headers:{'content-type':'application/pdf; version=1'}})
  if (url.pathname === '/multipart') {
    const form = await request.formData()
    const file = form.get('upload') as File
    return Response.json({name:file.name, type:file.type.split(';')[0], text:await file.text(), caption:form.get('caption')})
  }
  if (url.pathname === '/text') return new Response('123', { headers: { 'content-type': 'text/plain' } })
  if (url.pathname === '/header' && !request.headers.has('x-tenant')) return Response.json({ error: 'Missing tenant' }, { status: 400 })
  return Response.json({ path: url.pathname, query: [...url.searchParams], contentType: request.headers.get('content-type'), body: await request.text() })
} })
let browser: Awaited<ReturnType<typeof launch>> | undefined
try {
  browser = await launch()
  await browser.cdp.send('Page.navigate', { url: `http://127.0.0.1:${server.port}/` })
  const result = JSON.parse(await waitFor(() => browser!.cdp.evaluate<string>('document.querySelector("pre")?.textContent || ""'), 15_000))
  assert.deepEqual(result, {
    binaryBytes: [255,0,128,1], multipart:{name:'proof.txt',type:'text/plain',text:'actual bytes',caption:'kept'},
    collisionPaths: ['/a', '/b', '/c'], reservedOperation: '/config', configType: 'object', injected: false, missingHeader: 200,
    inheritedPath: '/inherited/alice', hyphenatedPath: '/hyphen/alice', dotRejected: true,
    arrayQuery: [['tag', 'a'], ['tag', 'b']], objectQuery: [['filter[name]', 'Alice']], omittedFormBody: 'name=Alice',
    combinedContentType: 'application/json', textValue: '123',
  })
  assert.deepEqual(browser.cdp.errors, [])
  console.log('generated client browser contracts OK')
}
finally { await browser?.close(); server.stop(true) }
