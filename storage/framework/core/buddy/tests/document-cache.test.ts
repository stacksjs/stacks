import { describe, expect, it } from 'bun:test'
import { applyDocumentCacheControl, buildDocumentCacheControl, isAuthenticatedRequest } from '../src/production-server'

function anon(headers: Record<string, string> = {}): Request {
  return new Request('https://example.com/privacy', { headers })
}

function html(init?: ResponseInit): Response {
  return new Response('<!doctype html><title>x</title>', {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    ...init,
  })
}

describe('buildDocumentCacheControl', () => {
  it('builds a shared-cache header from the declared seconds', () => {
    expect(buildDocumentCacheControl({ maxAge: 60, staleWhileRevalidate: 600 }))
      .toBe('public, max-age=60, stale-while-revalidate=600')
  })

  it('omits stale-while-revalidate when it was not asked for', () => {
    expect(buildDocumentCacheControl({ maxAge: 30 })).toBe('public, max-age=30')
  })

  it('declares nothing for an absent, zero or nonsense max-age', () => {
    expect(buildDocumentCacheControl()).toBeUndefined()
    expect(buildDocumentCacheControl({})).toBeUndefined()
    expect(buildDocumentCacheControl({ maxAge: 0 })).toBeUndefined()
    expect(buildDocumentCacheControl({ maxAge: -5 })).toBeUndefined()
    expect(buildDocumentCacheControl({ maxAge: Number.NaN })).toBeUndefined()
  })
})

describe('applyDocumentCacheControl', () => {
  const header = 'public, max-age=60'

  it('marks a plain HTML document cacheable', () => {
    expect(applyDocumentCacheControl(anon(), html(), header).headers.get('cache-control')).toBe(header)
  })

  it('REFUSES a document that sets a cookie', () => {
    // The safety of the whole feature. A response with Set-Cookie is about one
    // visitor; a shared cache told to reuse it serves their page, session
    // cookie and all, to whoever asks next.
    const response = html()
    response.headers.append('set-cookie', 'session=abc; Path=/; HttpOnly')

    expect(applyDocumentCacheControl(anon(), response, header).headers.get('cache-control')).toBeNull()
    expect(applyDocumentCacheControl(anon(), response, header).headers.getSetCookie()).toHaveLength(1)
  })

  it('REPLACES the pipeline default, which is the whole point', () => {
    // stx marks every page render `no-store`. A version that only filled in a
    // missing header could never fire, so declaring `documents` did nothing at
    // all — the defect this replaced.
    const response = html({ headers: { 'content-type': 'text/html', 'cache-control': 'no-store' } })
    expect(applyDocumentCacheControl(anon(), response, header).headers.get('cache-control')).toBe(header)
  })

  it('REFUSES an authenticated request even when the response sets nothing', () => {
    const signedIn = anon({ cookie: 'session_id=abc; X-CSRF-Token=t' })
    expect(applyDocumentCacheControl(signedIn, html(), header).headers.get('cache-control')).toBeNull()

    const bearer = anon({ authorization: 'Bearer abc' })
    expect(applyDocumentCacheControl(bearer, html(), header).headers.get('cache-control')).toBeNull()
  })

  it('only touches successful HTML', () => {
    const notFound = new Response('nope', { status: 404, headers: { 'content-type': 'text/html' } })
    expect(applyDocumentCacheControl(anon(), notFound, header).headers.get('cache-control')).toBeNull()

    const json = new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    expect(applyDocumentCacheControl(anon(), json, header).headers.get('cache-control')).toBeNull()
  })

  it('is a no-op when nothing was declared, so the default costs nothing', () => {
    const response = html()
    expect(applyDocumentCacheControl(anon(), response, undefined)).toBe(response)
  })

  it('keeps the body intact', async () => {
    const out = applyDocumentCacheControl(anon(), html(), header)
    expect(await out.text()).toContain('<!doctype html>')
  })
})

describe('isAuthenticatedRequest', () => {
  const req = (headers: Record<string, string>) => new Request('https://example.com/', { headers })

  it('does not count the CSRF cookie as a session', () => {
    // Every visitor gets one, signed in or not. Counting it would make every
    // page uncacheable for everybody.
    expect(isAuthenticatedRequest(req({ cookie: 'X-CSRF-Token=abc123' }))).toBe(false)
  })

  it('counts a bearer token', () => {
    expect(isAuthenticatedRequest(req({ authorization: 'Bearer abc' }))).toBe(true)
  })

  it('counts session-shaped cookies', () => {
    expect(isAuthenticatedRequest(req({ cookie: 'session_id=x' }))).toBe(true)
    expect(isAuthenticatedRequest(req({ cookie: 'auth_token=x' }))).toBe(true)
    expect(isAuthenticatedRequest(req({ cookie: 'remember_me=x' }))).toBe(true)
  })

  it('finds one among several', () => {
    expect(isAuthenticatedRequest(req({ cookie: 'theme=dark; X-CSRF-Token=t; auth_token=x' }))).toBe(true)
  })

  it('ignores cookies that are nobody\'s session', () => {
    expect(isAuthenticatedRequest(req({ cookie: 'theme=dark; locale=en' }))).toBe(false)
    expect(isAuthenticatedRequest(req({}))).toBe(false)
  })
})
