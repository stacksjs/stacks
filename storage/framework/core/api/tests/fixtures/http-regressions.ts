import { expect } from 'bun:test'
import { createHash } from 'node:crypto'
import { ConditionalValue, JsonResource, PaginatedResourceCollection } from '../../src/resource'
import { createStacksRouter } from '../../../router/src/stacks-router'

const cases = new Map<string, () => Promise<void>>()
function test(name: string, run: () => Promise<void>) {
  cases.set(name.split(' ')[0]!, run)
}

const rawUser = { id: 1, password: 'SHOULD_NOT_LEAVE_SERVER' }
class PublicUser extends JsonResource<typeof rawUser> {
  toArray() { return { id: this.resource.id } }
}
class Inline extends JsonResource<Record<string, unknown>> {
  toArray() { return this.resource }
}
class SpreadMerge extends JsonResource<unknown> {
  toArray() { return { id: 1, ...this.merge({ name: 'Alice' }) } }
}
class Relationship extends JsonResource<{ posts?: typeof rawUser[] }> {
  toArray() { return { posts: this.whenLoaded('posts', () => PublicUser.collection(this.resource.posts!)) } }
}

const router = createStacksRouter({ autoDiscoverRoutes: false })
router.get('/resource/conditional-array', () => new Inline({ items: [new ConditionalValue(false, { secret: rawUser.password })] }).toResponse())
router.get('/resource/nested', () => new Inline({ user: new PublicUser(rawUser) }).toResponse())
router.get('/resource/relationship', () => new Relationship({ posts: [rawUser] }).toResponse())
router.get('/resource/collection', () => PublicUser.collection([rawUser]).withRequest({ authToken: rawUser.password }))
router.get('/resource/matrix', () => new Inline({ matrix: [[1, 2], [3, 4]] }).toResponse())
router.get('/resource/merge', () => new SpreadMerge({}).toResponse())
router.get('/resource/deep', () => {
  let data: Record<string, unknown> = { hidden: new ConditionalValue(false, { secret: rawUser.password }) }
  for (let index = 0; index < 21; index++) data = { nested: data }
  return new Inline(data).toResponse()
})
router.get('/resource/prototype', () => new Inline(JSON.parse('{"__proto__":{"name":"kept"},"id":1}')).toResponse())
router.get('/resource/paginate-empty', () => PaginatedResourceCollection.fromPagination([], PublicUser, { currentPage: 1, perPage: 10, total: 0, baseUrl: '/items' }).toResponse())
router.get('/resource/paginate-past', () => PaginatedResourceCollection.fromPagination([], PublicUser, { currentPage: 99, perPage: 10, total: 20, baseUrl: '/items' }).toResponse())
router.get('/resource/paginate-query', () => PaginatedResourceCollection.fromPagination([rawUser], PublicUser, { currentPage: 1, perPage: 1, total: 2, baseUrl: '/items?status=active' }).toResponse())

const md5 = (value: string) => createHash('md5').update(value).digest('hex')
const server = Bun.serve({
  port: 0,
  hostname: '127.0.0.1',
  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/resource/')) return router.bunRouter.handleRequest(request)
    if (url.pathname === '/empty') return new Response(null, { status: 204 })
    if (url.pathname === '/text') return new Response('healthy', { headers: { 'content-type': 'text/plain' } })
    if (url.pathname === '/bad-json') return new Response('not-json', { headers: { 'content-type': 'application/json' } })
    const auth = request.headers.get('authorization')
    const body = await request.text()
    if (url.pathname.startsWith('/digest')) {
      if (!auth) return Response.json({ challenge: true }, { status: 401, headers: { 'www-authenticate': 'Digest realm="audit", nonce="nonce", qop="auth"' } })
      const fields = Object.fromEntries(Array.from(auth.matchAll(/(\w+)=(?:"([^"]*)"|([^,\s]+))/g), match => [match[1], match[2] ?? match[3]]))
      const uri = url.pathname + url.search
      const expected = md5(`${md5('user:audit:pass')}:nonce:${fields.nc}:${fields.cnonce}:auth:${md5(`${request.method}:${uri}`)}`)
      const valid = fields.uri === uri && fields.response === expected
      return Response.json({ valid, body }, { status: valid ? 200 : 401 })
    }
    if (url.pathname === '/items') return Response.json({ page: url.searchParams.get('page'), status: url.searchParams.get('status') })
    return Response.json({ path: url.pathname, query: Object.fromEntries(url.searchParams), auth, contentType: request.headers.get('content-type'), body })
  },
})
const base = `http://127.0.0.1:${server.port}`

let instance = 0
const fresh = async () => (await import(`../../src/fetcher?e2e=${++instance}`)).fetcher
const getResource = async (name: string) => (await fetch(`${base}/resource/${name}`)).json()
const secondOrigin = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch(request) { return Response.json({ auth: request.headers.get('authorization') }) } })

test('E2E01 concurrent requests keep independent credentials', async () => {
  const client = await fresh()
  const first = client.withToken('user-A').get(base + '/A')
  const second = client.withToken('user-B').get(base + '/B')
  const results = await Promise.all([first, second])
  expect(results[0].data.auth).toBe('Bearer user-A')
  expect(results[1].data.auth).toBe('Bearer user-B')
})
test('E2E02 failed responses cannot leak authorization to another origin', async () => {
  const client = await fresh()
  await client.withToken('user-A').get(base + '/bad-json').catch(() => {})
  const result = await client.get(`http://127.0.0.1:${secondOrigin.port}/capture`)
  expect(result.data.auth).toBeNull()
})
test('E2E03 nested resources apply their public projection', async () => {
  expect(await getResource('nested')).toEqual({ data: { user: { id: 1 } } })
  expect(await getResource('relationship')).toEqual({ data: { posts: [{ id: 1 }] } })
})
test('E2E04 returning a collection cannot expose source records or request context', async () => {
  expect(await getResource('collection')).toEqual({ data: [{ id: 1 }] })
})
test('E2E05 false conditional array entries cannot expose their values', async () => {
  expect(await getResource('conditional-array')).toEqual({ data: { items: [] } })
})
test('E2E06 the depth guard cannot bypass conditional exclusion', async () => {
  const response = await fetch(base + '/resource/deep')
  expect(response.status).toBe(500)
  expect((await response.text()).includes('SHOULD_NOT_LEAVE_SERVER')).toBe(false)
})
test('E2E07 valid default-MD5 digest credentials authenticate successfully', async () => {
  const result = await (await fresh()).withDigestAuth('user', 'pass').get(base + '/digest')
  expect(result.status).toBe(200)
})
test('E2E08 digest retries retain the stored request body', async () => {
  const result = await (await fresh()).withDigestAuth('user', 'pass').withBody({ important: 'kept' }).post(base + '/digest-body')
  expect(result.data.body).toBe('{"important":"kept"}')
})
test('E2E09 empty success and text responses remain usable responses', async () => {
  expect((await (await fresh()).delete(base + '/empty')).status).toBe(204)
  expect((await (await fresh()).accept('text/plain').get(base + '/text')).data).toBe('healthy')
})
test('E2E10 query parameters are inserted before URL fragments', async () => {
  expect((await (await fresh()).withQueryParams({ page: 2 }).get(base + '/query#section')).data.query.page).toBe('2')
})
test('E2E11 custom headers replace defaults independent of case', async () => {
  const result = await (await fresh()).withHeaders({ 'content-type': 'application/custom-json' }).post(base + '/headers', { a: 1 })
  expect(result.data.contentType).toBe('application/custom-json')
})
test('E2E12 nested arrays retain their JSON array shape', async () => {
  expect(await getResource('matrix')).toEqual({ data: { matrix: [[1, 2], [3, 4]] } })
})
test('E2E13 documented spread merge adds fields at the current resource level', async () => {
  expect(await getResource('merge')).toEqual({ data: { id: 1, name: 'Alice' } })
})
test('E2E14 resource serialization preserves special names as own JSON keys', async () => {
  expect(Object.hasOwn((await getResource('prototype')).data, '__proto__')).toBe(true)
})
test('E2E15 empty and out-of-range paginator metadata remain coherent', async () => {
  const empty = await getResource('paginate-empty')
  expect(empty.meta.last_page).toBe(1)
  expect(empty.links.last).toBe('/items?page=1')
  const past = await getResource('paginate-past')
  expect(past.meta.from).toBeNull()
  expect(past.meta.to).toBeNull()
})
test('E2E16 following pagination links preserves filters and advances the page', async () => {
  const page = await getResource('paginate-query')
  const next = await (await fetch(new URL(page.links.next, base))).json()
  expect(next.page).toBe('2')
  expect(next.status).toBe('active')
})

const scenario = process.env.API_HTTP_SCENARIO
try {
  const run = cases.get(scenario ?? '')
  if (!run) throw new Error(`Unknown API HTTP scenario: ${scenario}`)
  await run()
  console.log(`${scenario} OK`)
}
finally {
  server.stop(true)
  secondOrigin.stop(true)
}
