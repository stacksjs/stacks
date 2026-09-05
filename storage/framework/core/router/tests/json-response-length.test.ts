import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createStacksRouter } from '../src/stacks-router'

const router = createStacksRouter()
const small = { message: 'café 😀 漢字', items: [1, true, null] }
const large = { message: 'café 😀 漢字'.repeat(2048) }
let serializations = 0
router.get('/json-length/small', () => small)
router.get('/json-length/large', () => large)
router.get('/json-length/primitive-large', () => large.message)
router.get('/json-length/array', () => [small, 'é😀'])
router.get('/json-length/custom', () => ({ toJSON() { return { call: ++serializations } } }))
router.get('/json-length/empty', () => ({ toJSON() { return undefined } }))

const primitives = { string: 'café 😀', number: 42, boolean: true, nan: Number.NaN }
for (const [name, value] of Object.entries(primitives))
  router.get(`/json-length/primitive-${name}`, () => value)

const unsupported = { symbol: Symbol('unsupported'), function: () => 'unsupported', bigint: 1n }
for (const [name, value] of Object.entries(unsupported))
  router.get(`/json-length/unsupported-${name}`, () => value)

let server: Awaited<ReturnType<typeof router.serve>>

beforeAll(async () => {
  server = await router.serve({ port: 0, hostname: '127.0.0.1' })
})

afterAll(() => {
  server?.stop()
})

async function get(path: string, encoding = 'identity'): Promise<Response> {
  return fetch(`http://127.0.0.1:${server.port}/json-length/${path}`, {
    headers: { 'accept-encoding': encoding, 'cookie': 'X-CSRF-Token=already-mine' },
  })
}

describe('JSON byte lengths and compression', () => {
  test('small UTF-8 responses keep their exact bytes when gzip is accepted', async () => {
    const response = await get('small', 'gzip')
    const bytes = await response.bytes()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json;charset=utf-8')
    expect(response.headers.get('content-encoding')).toBeNull()
    expect(Number(response.headers.get('content-length'))).toBe(bytes.byteLength)
    expect(new TextDecoder().decode(bytes)).toBe(JSON.stringify(small))
    expect(response.headers.get('vary')).toContain('Accept-Encoding')
  })

  test('large JSON still compresses and does not retain its uncompressed length', async () => {
    for (const { path, body } of [{ path: 'large', body: large }, { path: 'primitive-large', body: large.message }]) {
      const response = await get(path, 'gzip')
      expect(response.status).toBe(200)
      expect(response.headers.get('content-encoding')).toBe('gzip')
      expect(response.headers.get('content-length')).toBeNull()
      expect(await response.json()).toEqual(body)
    }
  })

  test('identity responses retain the UTF-8 byte length for large bodies', async () => {
    const response = await get('large')
    const bytes = await response.bytes()
    expect(response.headers.get('content-encoding')).toBeNull()
    expect(Number(response.headers.get('content-length'))).toBe(bytes.byteLength)
    expect(new TextDecoder().decode(bytes)).toBe(JSON.stringify(large))
  })

  test('arrays retain their JSON shape and byte length', async () => {
    const response = await get('array', 'gzip')
    const bytes = await response.bytes()
    expect(Number(response.headers.get('content-length'))).toBe(bytes.byteLength)
    expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual([small, 'é😀'])
  })

  test('custom serialization runs once per response', async () => {
    for (const encoding of ['identity', 'gzip']) {
      const before = serializations
      const response = await get('custom', encoding)
      expect(await response.json()).toEqual({ call: before + 1 })
      expect(serializations).toBe(before + 1)
    }
  })

  test('an undefined custom serialization preserves the native empty body', async () => {
    for (const encoding of ['identity', 'gzip']) {
      const response = await get('empty', encoding)
      expect(response.status).toBe(200)
      expect(await response.text()).toBe('')
      expect(response.headers.get('content-length')).toBe('0')
    }
  })

  test('primitive JSON retains serialization and UTF-8 lengths in both encoding paths', async () => {
    for (const [name, value] of Object.entries(primitives)) {
      for (const encoding of ['identity', 'gzip']) {
        const response = await get(`primitive-${name}`, encoding)
        const bytes = await response.bytes()
        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')?.split(';')[0]).toBe('application/json')
        expect(response.headers.get('content-encoding')).toBeNull()
        expect(Number(response.headers.get('content-length'))).toBe(bytes.byteLength)
        expect(new TextDecoder().decode(bytes)).toBe(JSON.stringify(value))
      }
    }
  })

  test('browser navigation still negotiates primitive returns as plain text', async () => {
    const response = await fetch(`http://127.0.0.1:${server.port}/json-length/primitive-string`, {
      headers: { 'accept': 'text/html', 'sec-fetch-dest': 'document', 'accept-encoding': 'gzip' },
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(await response.text()).toBe(primitives.string)
  })

  test('unsupported JSON values retain the native serialization outcome', async () => {
    for (const [name, value] of Object.entries(unsupported)) {
      let expected: string | undefined
      try {
        expected = await Response.json(value).text()
      }
      catch { /* the native serializer rejects this value */ }
      for (const encoding of ['identity', 'gzip']) {
        const response = await get(`unsupported-${name}`, encoding)
        if (expected === undefined) {
          expect(response.status).toBe(500)
          await response.arrayBuffer()
        }
        else {
          expect(response.status).toBe(200)
          expect(await response.text()).toBe(expected)
        }
      }
    }
  })
})
