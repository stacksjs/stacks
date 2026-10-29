/**
 * A 4xx raised by middleware answers in the shape the caller asked for.
 *
 * `createMiddlewareErrorResponse` returned JSON for every 4xx, whatever the
 * caller was, while `createErrorResponse` had always asked `isApiRequest`
 * first. So a form post that failed the CSRF check put the API body on screen
 * instead of the 403 page - and the same went for every 4xx a middleware
 * raises before an action is reached: the 401 from auth, the 429 from the
 * rate limiter, maintenance mode.
 *
 * The JSON half is load-bearing for SPAs and is pinned here too: a `fetch`
 * sends `Accept: * / *` and must keep getting JSON it can read.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { HttpError } from '@stacksjs/error-handling'
import { createMiddlewareErrorResponse } from '../src/error-handler'

let prevAppEnv: string | undefined
let prevNodeEnv: string | undefined

beforeEach(() => {
  prevAppEnv = process.env.APP_ENV
  prevNodeEnv = process.env.NODE_ENV
  process.env.APP_ENV = 'production'
  process.env.NODE_ENV = 'production'
})

afterEach(() => {
  if (prevAppEnv === undefined) delete process.env.APP_ENV
  else process.env.APP_ENV = prevAppEnv
  if (prevNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = prevNodeEnv
})

/** What a browser sends when a person submits a form on a page. */
function formPost(): Request {
  return new Request('http://localhost/signup', {
    method: 'POST',
    headers: {
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'content-type': 'application/x-www-form-urlencoded',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
    },
  })
}

/** What a page's own script sends: no HTML signal anywhere. */
function spaFetch(): Request {
  return new Request('http://localhost/api/subscribe', {
    method: 'POST',
    headers: { 'accept': '*/*', 'content-type': 'application/json' },
  })
}

describe('createMiddlewareErrorResponse - what a 4xx looks like', () => {
  test('a browser submitting a form gets the error page, not the API body', async () => {
    const res = await createMiddlewareErrorResponse(new HttpError(403, 'CSRF token mismatch'), formPost())

    expect(res.status).toBe(403)
    expect(res.headers.get('content-type')).toContain('text/html')
    const body = await res.text()
    expect(body).toContain('<!DOCTYPE html>')
    expect(body).toContain('403')
    expect(body).toContain('Forbidden')
    // The visitor is never shown the raw shape, nor the internal error name.
    expect(body).not.toContain('"status":403')
    expect(body).not.toContain('CSRF token mismatch')
  })

  test('and a script calling the API still gets JSON it can read', async () => {
    const res = await createMiddlewareErrorResponse(new HttpError(403, 'CSRF token mismatch'), spaFetch())

    expect(res.status).toBe(403)
    expect(res.headers.get('content-type')).toContain('application/json')
    const body = await res.json()
    expect(body.status).toBe(403)
    expect(body.message).toBe('CSRF token mismatch')
  })

  test('a rate limit keeps its Retry-After on the way to a browser', async () => {
    const error = new HttpError(429, 'Too many requests') as HttpError & { headers?: Record<string, string> }
    error.headers = { 'Retry-After': '30' }
    const res = await createMiddlewareErrorResponse(error, formPost())

    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('30')
    expect(res.headers.get('content-type')).toContain('text/html')
  })

  test('5xx stays masked whoever asked', async () => {
    const res = await createMiddlewareErrorResponse(new HttpError(500, 'connection string leaked here'), formPost())

    expect(res.status).toBe(500)
    expect(await res.text()).not.toContain('connection string')
  })
})
