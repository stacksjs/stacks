import { beforeEach, describe, expect, test } from 'bun:test'
import process from 'node:process'
import { brotliDecompressSync } from 'node:zlib'
import { clearMiddlewareCache, createStacksRouter } from '../src/stacks-router'

beforeEach(() => clearMiddlewareCache())

const payload = 'compression-payload-'.repeat(150)
function request(path: string, encoding: string) {
  return new Request(`http://localhost${path}`, {
    headers: { accept: 'application/json', 'accept-encoding': encoding, 'x-request-id': 'compression-test' },
  })
}
async function readBody(response: Response) {
  const bytes = new Uint8Array(await response.arrayBuffer())
  const encoding = response.headers.get('content-encoding')
  return new TextDecoder().decode(encoding === 'br' ? brotliDecompressSync(bytes) : encoding === 'gzip' ? Bun.gunzipSync(bytes) : bytes)
}

describe('compression marker response integration', () => {
  test('cold concurrent and warm requests keep their own encoding and payload', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    router.get('/compressed/{id}', req => ({ id: req.params.id, payload })).middleware('compress')
    for (let round = 0; round < 2; round++) {
      const encodings = ['gzip', 'br', 'identity']
      const responses = await Promise.all(encodings.map(encoding => router.handleRequest(request(`/compressed/${encoding}`, encoding))))
      for (const [index, response] of responses.entries()) {
        const encoding = encodings[index]
        expect(response.status).toBe(200)
        expect(response.headers.get('content-encoding')).toBe(encoding === 'identity' ? null : encoding)
        expect(response.headers.get('x-request-id')).toBe('compression-test')
        expect(response.headers.get('x-content-type-options')).toBe('nosniff')
        expect(JSON.parse(await readBody(response))).toEqual({ id: encoding, payload })
      }
    }
  })

  test('small bodies retain status, bytes and existing headers', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    router.get('/small', () => new Response('small payload', { status: 201, headers: { 'content-type': 'text/plain', 'x-custom': 'kept', 'vary': 'Origin' } })).middleware('compress')
    const response = await router.handleRequest(request('/small', 'gzip'))
    expect(response.status).toBe(201)
    expect(response.headers.get('content-encoding')).toBeNull()
    expect(response.headers.get('x-custom')).toBe('kept')
    expect(response.headers.get('vary')).toContain('Origin')
    expect(await response.text()).toBe('small payload')
  })

  test('SSE bodies and already encoded responses are not re-encoded', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    router.get('/sse', () => new Response(`data: ${payload}\n\n`, { headers: { 'content-type': 'text/event-stream' } })).middleware('compress')
    router.get('/encoded', () => new Response(Bun.gzipSync(payload), { headers: { 'content-encoding': 'gzip', 'content-type': 'text/plain' } })).middleware('compress')
    const stream = await router.handleRequest(request('/sse', 'br'))
    expect(stream.headers.get('content-encoding')).toBeNull()
    expect(await stream.text()).toBe(`data: ${payload}\n\n`)
    const encoded = await router.handleRequest(request('/encoded', 'br'))
    expect(encoded.headers.get('content-encoding')).toBe('gzip')
    expect(await readBody(encoded)).toBe(payload)
  })

  test.each(['failure', 'function-failure', 'reload'])('preserves compression loader %s behavior in an isolated process', async (mode) => {
    const child = Bun.spawn([
      process.execPath,
      `--config=${import.meta.dir}/fixtures/cold-start.toml`,
      `${import.meta.dir}/fixtures/compression-loader.ts`,
      mode,
    ], { stdout: 'pipe', stderr: 'pipe' })
    const timeout = setTimeout(() => child.kill(), 10_000)
    try {
      const [code, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      expect(code, `${stdout}\n${stderr}`).toBe(0)
    }
    finally {
      clearTimeout(timeout)
    }
  })

  test('native serving preserves compressed response bytes and metadata', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    router.get('/native-compress', () => ({ payload })).middleware('compress')
    const server = await router.serve({ port: 0, nativeRoutes: true })
    try {
      const response = await fetch(`http://localhost:${server.port}/native-compress`, {
        headers: { 'accept-encoding': 'gzip', 'x-request-id': 'native-compression-test' },
      })
      expect(response.headers.get('content-encoding')).toBe('gzip')
      expect(response.headers.get('vary')).toContain('Accept-Encoding')
      expect(response.headers.get('x-request-id')).toBe('native-compression-test')
      expect(await response.json()).toEqual({ payload })
    }
    finally {
      await server.stop(true)
    }
  })
})
