/**
 * Regression coverage for stacksjs/stacks#1946.
 *
 * In production (`APP_ENV` not `development`), `createErrorResponse` used to
 * return the correct HTTP status for an `HttpError(4xx, …)` thrown from an
 * action handler but overwrite the body with the generic 500 text — dropping
 * `error.name` / `error.message` / `details`. That made a `422 "Already
 * subscribed"` indistinguishable from a `422 "A valid email is required"`.
 *
 * The production API branch is now 4xx-aware: it surfaces the real message for
 * client errors (mirroring `createMiddlewareErrorResponse`) and keeps masking
 * 5xx so internals never leak.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { HttpError } from '@stacksjs/error-handling'
import { createErrorResponse } from '../src/error-handler'

let prevAppEnv: string | undefined
let prevNodeEnv: string | undefined

beforeEach(() => {
  prevAppEnv = process.env.APP_ENV
  prevNodeEnv = process.env.NODE_ENV
  // Simulate production: debug must be disabled.
  process.env.APP_ENV = 'production'
  process.env.NODE_ENV = 'production'
})

afterEach(() => {
  if (prevAppEnv === undefined) delete process.env.APP_ENV
  else process.env.APP_ENV = prevAppEnv
  if (prevNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = prevNodeEnv
})

function apiReq(): Request {
  return new Request('http://localhost/api/subscribe', {
    method: 'POST',
    headers: { accept: 'application/json' },
  })
}

describe('createErrorResponse — production 4xx (#1946)', () => {
  test('surfaces HttpError name + message for a 4xx', async () => {
    const err = new HttpError(422, 'Already subscribed')
    const res = await createErrorResponse(err, apiReq(), { status: 422 })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.status).toBe(422)
    expect(body.error).toBe('Unprocessable Entity')
    expect(body.message).toBe('Already subscribed')
  })

  test('surfaces details object for a 4xx', async () => {
    const err = new HttpError(422, 'Validation failed', { email: ['A valid email is required'] })
    const res = await createErrorResponse(err, apiReq(), { status: 422 })

    const body = await res.json()
    expect(body.message).toBe('Validation failed')
    expect(body.details).toEqual({ email: ['A valid email is required'] })
  })

  test('still masks 5xx internals', async () => {
    const err = new HttpError(500, 'connection string leaked here')
    const res = await createErrorResponse(err, apiReq(), { status: 500 })

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal Server Error')
    expect(body.message).toBe('An unexpected error occurred.')
    expect(body.message).not.toContain('connection string')
    expect(body.details).toBeUndefined()
  })

  test('omits details when the 4xx carries none', async () => {
    const err = new HttpError(409, 'Conflict detected')
    const res = await createErrorResponse(err, apiReq(), { status: 409 })

    const body = await res.json()
    expect(body.error).toBe('Conflict')
    expect(body.message).toBe('Conflict detected')
    expect(body.details).toBeUndefined()
  })
})
