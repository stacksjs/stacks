import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import process from 'node:process'
import type { CorsConfig } from '@stacksjs/types'
import { config, overridesReady } from '@stacksjs/config'
import { HttpError } from '@stacksjs/error-handling'
import { clearMiddlewareCache, createStacksRouter } from '../src/stacks-router'

let previousAppEnv: string | undefined
let previousNodeEnv: string | undefined
let previousCors: CorsConfig | undefined
beforeEach(async () => {
  await overridesReady
  previousAppEnv = process.env.APP_ENV
  previousNodeEnv = process.env.NODE_ENV
  previousCors = config.cors
  process.env.APP_ENV = 'production'
  process.env.NODE_ENV = 'production'
  config.cors = { origin: ['https://caller.test'], credentials: true }
  clearMiddlewareCache()
})
afterEach(() => {
  if (previousAppEnv === undefined) delete process.env.APP_ENV
  else process.env.APP_ENV = previousAppEnv
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = previousNodeEnv
  config.cors = previousCors
  clearMiddlewareCache()
})

const modes = ['sync', 'async', 'promise'] as const
function register(router: ReturnType<typeof createStacksRouter>, mode: typeof modes[number], cors: boolean, makeError: () => unknown, method: 'get' | 'post' | 'options' = 'get') {
  let calls = 0
  const fail = () => { calls++; throw makeError() }
  const handler = mode === 'async'
    ? async () => fail()
    : mode === 'promise' ? () => Promise.resolve().then(fail) : fail
  const route = router[method]('/inline-error', handler)
  if (cors) route.middleware('cors')
  return () => calls
}
function request(method = 'GET') {
  return new Request('http://localhost/inline-error', {
    method,
    headers: {
      'accept': 'application/json',
      'origin': 'https://caller.test',
      'x-request-id': 'inline-error-test',
      'authorization': 'Bearer test-token',
    },
  })
}

async function assertResponse(response: Response, cors: boolean) {
  expect(response.status).toBe(422)
  expect(response.headers.get('x-request-id')).toBe('inline-error-test')
  expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  expect(response.headers.get('access-control-allow-origin')).toBe(cors ? 'https://caller.test' : null)
  if (cors) expect(response.headers.get('access-control-allow-credentials')).toBe('true')
  const body = await response.json()
  expect(body.status).toBe(422)
  expect(body.error).toBe('Unprocessable Entity')
  expect(body.message).toBe('Validation failed')
  expect(body.details).toEqual({ email: ['required'] })
  expect(body.request_id).toBe('inline-error-test')
}

describe('inline handler error finalization (#2459)', () => {
  for (const mode of modes) {
    for (const cors of [false, true]) {
      test(`${mode} errors preserve status, details and metadata with CORS ${cors}`, async () => {
        const router = createStacksRouter({ autoDiscoverRoutes: false })
        const calls = register(router, mode, cors, () => new HttpError(422, 'Validation failed', { email: ['required'] }))
        for (let i = 0; i < 2; i++) await assertResponse(await router.handleRequest(request()), cors)
        expect(calls()).toBe(2)
      })
    }
  }

  test('cold HTML errors retain status after asynchronous CSRF seeding', async () => {
    const child = Bun.spawn([
      process.execPath,
      `--config=${import.meta.dir}/fixtures/cold-start.toml`,
      `${import.meta.dir}/fixtures/inline-error-html.ts`,
    ], { stdout: 'pipe', stderr: 'pipe', env: { ...process.env, APP_ENV: 'production', NODE_ENV: 'production' } })
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

  test('OPTIONS errors pass through the synchronous invocation inside the async pipeline', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    register(router, 'sync', false, () => new HttpError(422, 'Validation failed', { email: ['required'] }), 'options')
    await assertResponse(await router.handleRequest(request('OPTIONS')), false)
  })

  test.each(modes)('explicit error callbacks retain ownership for %s handlers', async (mode) => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    const calls = register(router, mode, false, () => new Error('custom failure'))
    let caught = 0
    router.bunRouter.onError(error => {
      caught++
      return Response.json({ caught: error.message }, { status: 418 })
    })
    const response = await router.handleRequest(request())
    expect(response.status).toBe(418)
    expect(await response.json()).toEqual({ caught: 'custom failure' })
    expect(calls()).toBe(1)
    expect(caught).toBe(1)
  })

  test('POST inline errors retain framework status after body and CSRF processing', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    register(router, 'sync', true, () => new HttpError(422, 'Validation failed', { email: ['required'] }), 'post')
    await assertResponse(await router.handleRequest(request('POST')), true)
  })

  test.each([401, 503, 200, 700, 401.5, '401', undefined])('validates duck-typed statusCode %s and masks server errors', async (statusCode) => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    register(router, 'sync', false, () => Object.assign(new Error('private implementation detail'), { statusCode }))
    const response = await router.handleRequest(request())
    const expected = statusCode === 401 || statusCode === 503 ? statusCode : 500
    expect(response.status).toBe(expected)
    const body = await response.json()
    if (expected === 401) expect(body.message).toBe('private implementation detail')
    else {
      expect(body.message).toBe('An unexpected error occurred.')
      expect(JSON.stringify(body)).not.toContain('private implementation detail')
    }
  })

  test('direct actions use the same HTTP error finalizer', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    router.get('/inline-error', {
      name: 'DirectError',
      async handle() { throw new HttpError(422, 'Validation failed', { email: ['required'] }) },
    }).middleware('cors')
    await assertResponse(await router.handleRequest(request()), true)
  })

  test('formatting failures and non-Error throws are masked', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    router.get('/format-error', () => ({ toJSON() { throw new Error('private serializer detail') } }))
    router.get('/value-error', () => { throw 'private thrown value' })
    for (const path of ['/format-error', '/value-error']) {
      const response = await router.handleRequest(new Request(`http://localhost${path}`, { headers: request().headers }))
      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.message).toBe('An unexpected error occurred.')
      expect(JSON.stringify(body)).not.toContain('private')
    }
  })

  for (const cors of [false, true]) {
    test.each(modes)(`native serving finalizes %s inline failures with CORS ${cors}`, async (mode) => {
      const router = createStacksRouter({ autoDiscoverRoutes: false })
      register(router, mode, cors, () => new HttpError(422, 'Validation failed', { email: ['required'] }))
      const server = await router.serve({ port: 0, nativeRoutes: true })
      try {
        await assertResponse(await fetch(`http://localhost:${server.port}/inline-error`, { headers: request().headers }), cors)
      }
      finally {
        await server.stop(true)
      }
    })
  }
})
