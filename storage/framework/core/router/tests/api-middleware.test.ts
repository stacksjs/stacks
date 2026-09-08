import type { CorsConfig } from '@stacksjs/types'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { config, overridesReady } from '@stacksjs/config'
import { clearMiddlewareCache, createStacksRouter } from '../src/stacks-router'

let originalCors: CorsConfig | undefined
beforeEach(async () => {
  await overridesReady
  originalCors = config.cors
  config.cors = { origin: '*' }
  clearMiddlewareCache()
})
afterEach(() => {
  config.cors = originalCors
  clearMiddlewareCache()
})

const headers = (accept?: string) => ({ origin: 'https://caller.test', ...(accept === undefined ? {} : { accept }) })

describe('API guard and CORS ordering', () => {
  test('cold and warm API rejection stays fail-closed with CORS headers', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    let calls = 0
    router.get('/api-guard', () => { calls++; return { ok: true } }).middleware(['api', 'cors'])
    for (let round = 0; round < 2; round++) {
      for (const accept of [undefined, 'text/plain', 'application/json', '*/*']) {
        const before = calls
        const allowed = accept === 'application/json' || accept === '*/*'
        const response = await router.handleRequest(new Request('http://localhost/api-guard', { headers: headers(accept) }))
        expect(response.status).toBe(allowed ? 200 : 406)
        expect(response.headers.get('access-control-allow-origin')).toBe('*')
        expect(calls).toBe(before + (allowed ? 1 : 0))
        const body = await response.json()
        if (allowed) expect(body).toEqual({ ok: true })
        else expect(body.message).toBe('This endpoint only serves JSON responses. Set Accept: application/json.')
      }
    }
  })

  test('CORS preflight wins over an API guard that would reject its Accept header', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    let calls = 0
    router.options('/api-guard', () => { calls++; return { ok: true } }).middleware(['api', 'cors'])
    const response = await router.handleRequest(new Request('http://localhost/api-guard', {
      method: 'OPTIONS',
      headers: { ...headers('text/plain'), 'access-control-request-method': 'POST' },
    }))
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(response.headers.get('access-control-allow-methods')).toBe('POST')
    expect(await response.text()).toBe('')
    expect(calls).toBe(0)
  })

  test('native requests preserve accepted, rejected and preflight responses', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    let calls = 0
    const handler = () => { calls++; return { ok: true } }
    router.get('/native-api', handler).middleware(['api', 'cors'])
    router.options('/native-api', handler).middleware(['api', 'cors'])
    const server = await router.serve({ port: 0, nativeRoutes: true })
    try {
      const url = `http://localhost:${server.port}/native-api`
      const accepted = await fetch(url, { headers: headers('application/json') })
      expect(accepted.status).toBe(200)
      expect(await accepted.json()).toEqual({ ok: true })
      const rejected = await fetch(url, { headers: headers('text/plain') })
      expect(rejected.status).toBe(406)
      expect(rejected.headers.get('access-control-allow-origin')).toBe('*')
      expect((await rejected.json()).message).toContain('only serves JSON')
      const preflight = await fetch(url, { method: 'OPTIONS', headers: { ...headers('text/plain'), 'access-control-request-method': 'POST' } })
      expect(preflight.status).toBe(204)
      expect(preflight.headers.get('access-control-allow-origin')).toBe('*')
      expect(calls).toBe(1)
    }
    finally {
      await server.stop(true)
    }
  })
})
