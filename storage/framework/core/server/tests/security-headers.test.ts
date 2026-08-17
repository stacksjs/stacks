/**
 * View security headers (stacksjs/stacks#2325).
 *
 * The report was an HTTP measurement: `/api/auth/forgot` carried
 * `X-Frame-Options`, `X-Content-Type-Options` and `Referrer-Policy`, and
 * `/login` carried none of them. These tests pin the behaviour that closes
 * that gap, plus the two headers this path deliberately does NOT send.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import process from 'node:process'
import {
  __resetViewSecurityHeadersCache,
  applyViewSecurityHeaders,
  isEmbeddablePath,
  resolveEmbeddableRules,
} from '../src/security-headers'

function request(path: string): Request {
  return new Request(`http://localhost:3000${path}`)
}

/** A page response, the shape stx-serve produces. */
function page(status = 200): Response {
  return new Response('<!doctype html><title>x</title>', {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

afterEach(() => {
  delete process.env.STACKS_SECURITY_HEADERS_DISABLE
  __resetViewSecurityHeadersCache()
})

describe('resolveEmbeddableRules', () => {
  test('splits prefixes from exact paths on the trailing slash', () => {
    const rules = resolveEmbeddableRules(['/embed/', '/share/card'])

    expect(rules.prefixes).toEqual(['/embed/'])
    expect(rules.paths).toEqual(['/share/card'])
  })

  test('drops entries that are not absolute paths, and de-duplicates', () => {
    // A relative entry cannot match a pathname, so silently keeping it would
    // read as configured-but-broken.
    const rules = resolveEmbeddableRules(['embed', '', '  ', '/a', '/a', '/b/', '/b/'])

    expect(rules.paths).toEqual(['/a'])
    expect(rules.prefixes).toEqual(['/b/'])
  })

  test('an unset config is empty rather than throwing', () => {
    expect(resolveEmbeddableRules()).toEqual({ paths: [], prefixes: [] })
  })

  test('a bare "/" stays an exact path, so it cannot make the whole site frameable', () => {
    // `/` as a prefix would match every path on the site. That is a
    // catastrophic reading of one character, so it is treated as the exact
    // document root and nothing else.
    const rules = resolveEmbeddableRules(['/'])

    expect(rules.prefixes).toEqual([])
    expect(rules.paths).toEqual(['/'])
    expect(isEmbeddablePath('/anything', rules)).toBe(false)
    expect(isEmbeddablePath('/', rules)).toBe(true)
  })
})

describe('isEmbeddablePath', () => {
  test('a prefix matches the bare path and anything under it', () => {
    const rules = resolveEmbeddableRules(['/embed/'])

    expect(isEmbeddablePath('/embed', rules)).toBe(true)
    expect(isEmbeddablePath('/embed/', rules)).toBe(true)
    expect(isEmbeddablePath('/embed/chart/7', rules)).toBe(true)
  })

  test('a prefix does not match a longer sibling name', () => {
    // `/embed/` must not match `/embedded-secrets`.
    const rules = resolveEmbeddableRules(['/embed/'])

    expect(isEmbeddablePath('/embedded-secrets', rules)).toBe(false)
  })
})

describe('applyViewSecurityHeaders', () => {
  test('sets exactly the three headers the report found missing', () => {
    const res = page()

    expect(applyViewSecurityHeaders(request('/login'), res, resolveEmbeddableRules())).toBeUndefined()

    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })

  test('does not send a CSP, even when STACKS_CSP is set', () => {
    // The router sends one on API responses when this is set. Carrying it onto
    // pages would break inline stx bootstrapping in an app that had only ever
    // tested the policy against JSON.
    process.env.STACKS_CSP = 'default-src \'self\''
    __resetViewSecurityHeadersCache()
    const res = page()

    applyViewSecurityHeaders(request('/login'), res, resolveEmbeddableRules())

    expect(res.headers.get('Content-Security-Policy')).toBeNull()
    delete process.env.STACKS_CSP
  })

  test('does not send HSTS, even when the env says production', () => {
    // `buddy serve` forces APP_ENV=production, so this branch is reachable on
    // a laptop, where HSTS would pin localhost to HTTPS for a year.
    const previous = process.env.APP_ENV
    process.env.APP_ENV = 'production'
    __resetViewSecurityHeadersCache()
    const res = page()

    applyViewSecurityHeaders(request('/login'), res, resolveEmbeddableRules())

    expect(res.headers.get('Strict-Transport-Security')).toBeNull()
    process.env.APP_ENV = previous
  })

  test('an embeddable path loses X-Frame-Options and keeps the rest', () => {
    const rules = resolveEmbeddableRules(['/embed/'])
    const res = page()

    applyViewSecurityHeaders(request('/embed/chart/7'), res, rules)

    expect(res.headers.get('X-Frame-Options')).toBeNull()
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })

  test('a non-embeddable path on the same server still gets framed protection', () => {
    const rules = resolveEmbeddableRules(['/embed/'])
    const res = page()

    applyViewSecurityHeaders(request('/dashboard'), res, rules)

    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
  })

  test('never overwrites a header the app already set', () => {
    const res = new Response('x', { headers: { 'X-Frame-Options': 'DENY' } })

    applyViewSecurityHeaders(request('/login'), res, resolveEmbeddableRules())

    expect(res.headers.get('X-Frame-Options')).toBe('DENY')
  })

  test('STACKS_SECURITY_HEADERS_DISABLE=true turns the whole set off', () => {
    process.env.STACKS_SECURITY_HEADERS_DISABLE = 'true'
    __resetViewSecurityHeadersCache()
    const res = page()

    applyViewSecurityHeaders(request('/login'), res, resolveEmbeddableRules())

    expect(res.headers.get('X-Frame-Options')).toBeNull()
    expect(res.headers.get('X-Content-Type-Options')).toBeNull()
    expect(res.headers.get('Referrer-Policy')).toBeNull()
  })

  test('a 404 page is protected too', () => {
    // The reported symptom was on /login, but a 404 is still a rendered
    // document, and the CMS fallback can turn one into a real page.
    const res = page(404)

    applyViewSecurityHeaders(request('/nope'), res, resolveEmbeddableRules())

    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
  })

  test('a response whose headers refuse to be set is rebuilt rather than throwing', () => {
    // Defensive, and deliberately kept: `stacks-router.ts` carries the same
    // fallback. No Response Bun currently produces actually guards its header
    // list - `Response.redirect()`, `Response.json()`, `Response.error()` and
    // `new Response()` were all measured as mutable - so the only honest way
    // to exercise this branch is a stub that throws the way a guarded
    // response would.
    const headers = new Headers({ 'Content-Type': 'text/html' })
    const guarded = {
      body: 'x',
      status: 302,
      statusText: 'Found',
      headers: {
        has: (name: string) => headers.has(name),
        set: () => { throw new TypeError('immutable') },
        entries: () => headers.entries(),
        [Symbol.iterator]: () => headers[Symbol.iterator](),
      },
    } as unknown as Response

    const replacement = applyViewSecurityHeaders(request('/old'), guarded, resolveEmbeddableRules())

    expect(replacement).toBeInstanceOf(Response)
    expect(replacement!.status).toBe(302)
    expect(replacement!.headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
    expect(replacement!.headers.get('Content-Type')).toBe('text/html')
  })
})
