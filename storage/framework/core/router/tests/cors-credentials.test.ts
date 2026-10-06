/**
 * A wildcard CORS policy with credentials allows no origin.
 *
 * `{ origin: '*', credentials: true }` echoed whatever Origin the request
 * carried, beside `Access-Control-Allow-Credentials: true`. The spec forbids
 * `*` with credentials precisely so a page cannot read a signed-in user's
 * responses from another site, and reflecting the Origin undid that for
 * every site at once. The docblock said this misconfiguration was prevented.
 */

import { describe, expect, test } from 'bun:test'
import { applyCorsHeaders, buildPreflightResponse } from '../../../defaults/app/Middleware/Cors'

const base = { methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'], exposedHeaders: [], maxAge: 600 }

function request(origin: string, method = 'GET', preflight = false): Request {
  const headers: Record<string, string> = { origin }
  if (preflight)
    headers['access-control-request-method'] = 'POST'
  return new Request('https://api.example.test/me', { method, headers })
}

describe('CORS with credentials', () => {
  test('a wildcard policy echoes no origin, on a request or a preflight', () => {
    const cfg = { ...base, origin: '*' as const, credentials: true }

    const response = applyCorsHeaders(request('https://evil.test'), new Response('{}'), cfg)
    expect(response.headers.get('access-control-allow-origin')).toBeNull()

    const preflight = buildPreflightResponse(request('https://evil.test', 'OPTIONS', true), cfg)
    expect(preflight.headers.get('access-control-allow-origin')).toBeNull()
  })

  test('a listed origin is still echoed with credentials, and an unlisted one is not', () => {
    const cfg = { ...base, origin: ['https://app.test'], credentials: true }

    const allowed = applyCorsHeaders(request('https://app.test'), new Response('{}'), cfg)
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://app.test')
    expect(allowed.headers.get('access-control-allow-credentials')).toBe('true')

    const denied = applyCorsHeaders(request('https://evil.test'), new Response('{}'), cfg)
    expect(denied.headers.get('access-control-allow-origin')).toBeNull()
  })

  test('a wildcard policy without credentials still answers *', () => {
    const cfg = { ...base, origin: '*' as const, credentials: false }
    const response = applyCorsHeaders(request('https://anyone.test'), new Response('{}'), cfg)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(response.headers.get('access-control-allow-credentials')).toBeNull()
  })
})
