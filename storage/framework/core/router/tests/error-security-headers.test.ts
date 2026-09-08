import { afterEach, beforeEach, expect, test } from 'bun:test'
import process from 'node:process'
import { createErrorResponse, createMiddlewareErrorResponse, createNotFoundResponse, createValidationErrorResponse } from '../src/error-handler'
import { __resetSecurityHeadersCache } from '../src/security-headers'

const envKeys = ['APP_ENV', 'NODE_ENV', 'STACKS_SECURITY_HEADERS_DISABLE', 'STACKS_CSP', 'STACKS_CSP_REPORT_ONLY'] as const
let saved: Record<string, string | undefined>
beforeEach(() => {
  saved = Object.fromEntries(envKeys.map(key => [key, process.env[key]]))
  process.env.APP_ENV = 'production'
  delete process.env.STACKS_SECURITY_HEADERS_DISABLE
  process.env.STACKS_CSP = "default-src 'self'"
  delete process.env.STACKS_CSP_REPORT_ONLY
  __resetSecurityHeadersCache()
})
afterEach(() => {
  for (const key of envKeys) {
    if (saved[key] === undefined)
      delete process.env[key]
    else
      process.env[key] = saved[key]
  }
  __resetSecurityHeadersCache()
})

async function errorResponses() {
  const api = new Request('http://localhost/missing', { headers: { accept: 'application/json' } })
  const browser = new Request('http://localhost/missing', { headers: { accept: 'text/html' } })
  return Promise.all([
    createErrorResponse(new Error('internal detail'), api),
    createMiddlewareErrorResponse(Object.assign(new Error('denied'), { status: 403 }), api),
    createMiddlewareErrorResponse(new Error('internal detail'), api),
    createValidationErrorResponse({ field: ['required'] }, api),
    createNotFoundResponse('/missing', api),
    createErrorResponse(new Error('internal detail'), browser),
    createNotFoundResponse('/missing', browser),
  ])
}

test('JSON and HTML error factories apply production security defaults', async () => {
  const responses = await errorResponses()
  expect(responses.map(response => response.status)).toEqual([500, 403, 500, 422, 404, 500, 404])
  for (const [index, response] of responses.entries()) {
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN')
    expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
    expect(response.headers.get('strict-transport-security')).toBe('max-age=31536000; includeSubDomains')
    expect(response.headers.get('content-security-policy')).toBe("default-src 'self'")
    expect(response.headers.get('content-type')).toBe(index < 5 ? 'application/json' : 'text/html; charset=utf-8')
    const body = await response.text()
    if (response.status === 500)
      expect(body).not.toContain('internal detail')
  }
})

test('explicit per-error security headers and Retry-After survive normalization', async () => {
  const error = Object.assign(new Error('limited'), {
    status: 429,
    headers: { 'x-frame-options': 'DENY', 'Content-Security-Policy': "default-src 'none'", 'Retry-After': '12', 'content-type': 'text/plain' },
  })
  const response = await createMiddlewareErrorResponse(error, new Request('http://localhost/'))
  expect(response.status).toBe(429)
  expect(response.headers.get('x-frame-options')).toBe('DENY')
  expect(response.headers.get('content-security-policy')).toBe("default-src 'none'")
  expect(response.headers.get('retry-after')).toBe('12')
  expect(response.headers.get('content-type')).toBe('application/json')
  expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  expect((await response.json()).message).toBe('limited')
})

test('the security opt-out applies to error factories too', async () => {
  process.env.STACKS_SECURITY_HEADERS_DISABLE = 'true'
  __resetSecurityHeadersCache()
  for (const response of await errorResponses()) {
    for (const name of ['x-content-type-options', 'x-frame-options', 'referrer-policy', 'strict-transport-security', 'content-security-policy'])
      expect(response.headers.has(name)).toBe(false)
    await response.text()
  }
})
