import type { CorsConfig } from '@stacksjs/types'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import process from 'node:process'
import { config, overridesReady } from '@stacksjs/config'
import { clearMiddlewareCache, createStacksRouter } from '../src/stacks-router'

let original: CorsConfig | undefined
beforeEach(async () => {
  await overridesReady
  original = config.cors
  config.cors = { origin: '*' }
  clearMiddlewareCache()
})
afterEach(() => {
  config.cors = original
  clearMiddlewareCache()
})

function request(path: string, origin = 'https://caller.test') {
  return new Request(`https://example.test${path}`, { headers: { origin, accept: 'application/json' } })
}

describe('CORS response finalization', () => {
  test('cold concurrent and warm requests retain their own bodies and origins', async () => {
    config.cors = { origin: ['https://one.test', 'https://two.test'], credentials: true }
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    router.get('/cors/{id}', req => ({ id: req.params.id })).middleware('cors')
    for (let round = 0; round < 2; round++) {
      const responses = await Promise.all(['one', 'two'].map(id => router.handleRequest(request(`/cors/${id}`, `https://${id}.test`))))
      for (const [index, response] of responses.entries()) {
        const id = index === 0 ? 'one' : 'two'
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ id })
        expect(response.headers.get('access-control-allow-origin')).toBe(`https://${id}.test`)
        expect(response.headers.get('access-control-allow-credentials')).toBe('true')
        expect(response.headers.get('vary')).toBe('Origin, Accept-Encoding')
      }
    }
  })

  test('a cached function continues to use live configuration and reject disallowed origins', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    router.get('/cors-policy', () => ({ ok: true })).middleware('cors')
    expect((await router.handleRequest(request('/cors-policy'))).headers.get('access-control-allow-origin')).toBe('*')

    config.cors = { origin: ['https://allowed.test'], credentials: true, exposedHeaders: ['X-Trace'] }
    const allowed = await router.handleRequest(request('/cors-policy', 'https://allowed.test'))
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://allowed.test')
    expect(allowed.headers.get('access-control-allow-credentials')).toBe('true')
    expect(allowed.headers.get('access-control-expose-headers')).toBe('X-Trace')
    const denied = await router.handleRequest(request('/cors-policy', 'https://denied.test'))
    expect(denied.headers.get('access-control-allow-origin')).toBeNull()
    expect(denied.headers.get('vary')).toBe('Origin, Accept-Encoding')
    expect(await denied.json()).toEqual({ ok: true })
  })

  test('a throwing origin policy does not poison later requests', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    router.get('/cors-policy-error', () => ({ ok: true })).middleware('cors')
    config.cors = { origin: () => { throw new Error('policy unavailable') } }
    const failed = await router.handleRequest(request('/cors-policy-error'))
    expect(failed.status).toBe(200)
    expect(failed.headers.get('access-control-allow-origin')).toBeNull()
    config.cors = { origin: '*' }
    expect((await router.handleRequest(request('/cors-policy-error'))).headers.get('access-control-allow-origin')).toBe('*')
  })

  test('error responses retain CORS and existing Vary dimensions', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    router.get('/cors-failure', () => ({ unreachable: true })).middleware('cors').middleware('auth')
    router.get('/cors-vary', () => new Response('ok', { headers: { Vary: 'Accept-Encoding, origin' } })).middleware('cors')
    for (let round = 0; round < 2; round++) {
      const failure = await router.handleRequest(request('/cors-failure'))
      expect(failure.status).toBe(401)
      expect(failure.headers.get('access-control-allow-origin')).toBe('*')
      expect(failure.headers.get('vary')).toContain('Origin')
      const response = await router.handleRequest(request('/cors-vary'))
      expect(response.headers.get('vary')).toBe('Accept-Encoding, origin')
      expect(await response.text()).toBe('ok')
    }
  })

  test('preflight still short-circuits and advertises all varying request dimensions', async () => {
    config.cors = { origin: ['https://caller.test'], credentials: true, methods: ['GET', 'PUT'], maxAge: 60 }
    let calls = 0
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    router.options('/cors-options', () => { calls++; return { ok: true } }).middleware('cors')
    const response = await router.handleRequest(new Request('https://example.test/cors-options', {
      method: 'OPTIONS',
      headers: { origin: 'https://caller.test', 'access-control-request-method': 'PUT', 'access-control-request-headers': 'X-Custom' },
    }))
    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
    expect(calls).toBe(0)
    expect(response.headers.get('access-control-allow-origin')).toBe('https://caller.test')
    expect(response.headers.get('access-control-allow-methods')).toBe('PUT')
    expect(response.headers.get('access-control-allow-headers')).toBe('X-Custom')
    expect(response.headers.get('access-control-max-age')).toBe('60')
    expect(response.headers.get('vary')).toBe('Origin, Access-Control-Request-Method, Access-Control-Request-Headers')
    const plain = await router.handleRequest(new Request('https://example.test/cors-options', { method: 'OPTIONS' }))
    expect(plain.status).toBe(200)
    expect(calls).toBe(1)
  })

  test('warming CORS does not add policy headers to routes without middleware', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    router.get('/cors-warm', () => ({ ok: true })).middleware('cors')
    router.get('/cors-plain', () => ({ ok: true }))
    await router.handleRequest(request('/cors-warm'))
    const response = await router.handleRequest(request('/cors-plain'))
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
    expect(response.headers.get('access-control-allow-credentials')).toBeNull()
    expect(await response.json()).toEqual({ ok: true })
  })

  test.each(['failure', 'reload'])('preserves loader %s behavior in an isolated process', async (mode) => {
    const child = Bun.spawn([
      process.execPath,
      `--config=${import.meta.dir}/fixtures/cold-start.toml`,
      `${import.meta.dir}/fixtures/cors-loader.ts`,
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

})
