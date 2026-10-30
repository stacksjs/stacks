/**
 * Headers a middleware asked for are on a refusal too (stacksjs/stacks#2993).
 *
 * `_responseHeaders` were applied after the action, so a later middleware that
 * refused the request returned through the early error path without them. A
 * policy such as `Cache-Control: private, no-store` set ahead of auth or CSRF
 * was on the 200 and missing from the 403.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { appPath } from '@stacksjs/path'
import { clearMiddlewareCache, clearRouteMiddlewareRegistry, createStacksRouter } from '../src/stacks-router'

const id = crypto.randomUUID().replaceAll('-', '')
const policyName = `PolicyFixture${id}`
const refuseName = `RefuseFixture${id}`
const files = [appPath(`Middleware/${policyName}.ts`), appPath(`Middleware/${refuseName}.ts`)]
let aliases: Record<string, string>

beforeAll(async () => {
  mkdirSync(appPath('Middleware'), { recursive: true })
  aliases = (await import(appPath('Middleware.ts'))).default
  aliases.__policy = policyName
  aliases.__refuse = refuseName
  writeFileSync(files[0]!, `
export default {
  priority: 0,
  handle(request) {
    request._responseHeaders = { 'Cache-Control': 'private, no-store', 'X-Request-ID': 'a-middleware-wrote-this' }
  },
}
`)
  writeFileSync(files[1]!, `
import { HttpError } from '@stacksjs/error-handling'
export default {
  handle(request) {
    if (request.params.outcome === 'response')
      throw new Response('short circuit', { status: 409 })
    if (request.params.outcome === 'error')
      throw new HttpError(403, 'refused')
  },
}
`)
  clearMiddlewareCache()
})

beforeEach(() => {
  clearRouteMiddlewareRegistry()
})

afterAll(() => {
  delete aliases.__policy
  delete aliases.__refuse
  for (const file of files) unlinkSync(file)
  clearMiddlewareCache()
  clearRouteMiddlewareRegistry()
})

function requestWithId(url: string, init?: RequestInit): Request {
  const request = new Request(url, init)
  Object.assign(request, { _requestId: 'the-router-owns-this' })
  return request
}

describe('a middleware refusal', () => {
  test('carries the headers an earlier middleware asked for when it throws an error', async () => {
    const router = createStacksRouter()
    router.get('/refused/{outcome}', () => new Response('handled')).middleware(['__policy', '__refuse'])

    const response = await router.handleRequest(requestWithId('http://localhost/refused/error'))

    expect(response.status).toBe(403)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('x-request-id')).toBe('the-router-owns-this')
  })

  test('carries them when it throws a Response', async () => {
    const router = createStacksRouter()
    router.get('/refused/{outcome}', () => new Response('handled')).middleware(['__policy', '__refuse'])

    const response = await router.handleRequest(requestWithId('http://localhost/refused/response'))

    expect(response.status).toBe(409)
    expect(await response.text()).toBe('short circuit')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  test('carries them on the native CSRF denial, as in the report', async () => {
    const router = createStacksRouter()
    router.post('/refused/csrf', () => new Response('handled')).middleware('__policy')

    const response = await router.handleRequest(requestWithId('http://localhost/refused/csrf', { method: 'POST' }))

    expect(response.status).toBe(403)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  test('leaves an allowed request as it was', async () => {
    const router = createStacksRouter()
    router.get('/refused/{outcome}', () => new Response('handled')).middleware(['__policy', '__refuse'])

    const response = await router.handleRequest(requestWithId('http://localhost/refused/allowed'))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })
})
