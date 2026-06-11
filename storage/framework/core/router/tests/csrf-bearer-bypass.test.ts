import { describe, expect, test } from 'bun:test'
import type { EnhancedRequest } from '@stacksjs/bun-router'
import { Csrf } from '@stacksjs/bun-router'

/**
 * Tests for the bearer-token CSRF bypass (stacksjs/stacks#1922).
 *
 * Previously: any POST/PUT/PATCH/DELETE with `Authorization: Bearer
 * …` and no `X-CSRF-TOKEN` got a 403, even though CSRF is
 * categorically not applicable to bearer auth (the token doesn't
 * ride on cookies, so a hostile origin can't trick a browser into
 * sending it). The router docs already promised this behaviour;
 * the middleware just didn't implement it.
 *
 * After: bearer-authed unsafe-method requests skip CSRF verification
 * outright. Mirrors Laravel Sanctum / Django REST framework /
 * express-csurf semantics.
 */

function makeRequest(
  method: string,
  headers: Record<string, string> = {},
  body?: string,
): EnhancedRequest {
  return new Request('http://localhost/api/orders', {
    method,
    headers,
    body,
  }) as EnhancedRequest
}

describe('CSRF middleware — bearer-token bypass (stacksjs/stacks#1922)', () => {
  test('POST with valid Bearer token but no CSRF token → passes through', async () => {
    const csrf = new Csrf()
    const req = makeRequest('POST', {
      'Authorization': 'Bearer pat_test_abc123',
      'Content-Type': 'application/json',
    }, JSON.stringify({ items: [] }))

    const next = async () => new Response('ok', { status: 200 })
    const response = await csrf.handle(req, next)

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('ok')
  })

  test('PATCH with Bearer token (lowercase header) → passes through', async () => {
    // Headers are case-insensitive — middleware must check both casings.
    const csrf = new Csrf()
    const req = makeRequest('PATCH', {
      'authorization': 'Bearer pat_test_abc123',
    })

    const next = async () => new Response('ok', { status: 200 })
    const response = await csrf.handle(req, next)
    expect(response.status).toBe(200)
  })

  test('DELETE with Bearer token → passes through', async () => {
    const csrf = new Csrf()
    const req = makeRequest('DELETE', {
      'Authorization': 'Bearer pat_test_abc123',
    })

    const next = async () => new Response(null, { status: 204 })
    const response = await csrf.handle(req, next)
    expect(response.status).toBe(204)
  })

  test('POST with Authorization: Basic ... → does NOT bypass (basic auth is cookie-adjacent)', async () => {
    const csrf = new Csrf()
    const req = makeRequest('POST', {
      'Authorization': 'Basic dXNlcjpwYXNz',
      'Content-Type': 'application/json',
    })

    const next = async () => new Response('ok', { status: 200 })
    const response = await csrf.handle(req, next)
    // No bearer, no CSRF token, no cookie → 403.
    expect(response.status).toBe(403)
    const body = await response.json() as { error: string }
    expect(body.error).toBe('CSRF token validation failed')
  })

  test('POST with no Authorization header → CSRF still enforced (regression guard)', async () => {
    const csrf = new Csrf()
    const req = makeRequest('POST', {
      'Content-Type': 'application/json',
    })

    const next = async () => new Response('ok', { status: 200 })
    const response = await csrf.handle(req, next)
    expect(response.status).toBe(403)
  })

  test('POST with malformed Authorization: Bearer (no token) → does NOT bypass', async () => {
    // A header that's literally `Bearer ` with no token must not
    // bypass — that's a malformed request, not a legit auth attempt.
    const csrf = new Csrf()
    const req = makeRequest('POST', {
      'Authorization': 'Bearer ',
    })

    const next = async () => new Response('ok', { status: 200 })
    const response = await csrf.handle(req, next)
    expect(response.status).toBe(403)
  })

  test('GET with Bearer token → already exempt (safe method, no regression)', async () => {
    // Safe methods were always exempt — this test just pins that the
    // bearer branch doesn't interfere with the existing safe-method path.
    const csrf = new Csrf()
    const req = makeRequest('GET', {
      'Authorization': 'Bearer pat_test_abc123',
    })

    const next = async () => new Response('ok', { status: 200 })
    const response = await csrf.handle(req, next)
    expect(response.status).toBe(200)
  })
})
