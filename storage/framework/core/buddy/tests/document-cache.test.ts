import { describe, expect, it } from 'bun:test'
import { applyDocumentCacheControl, buildDocumentCacheControl } from '../src/production-server'

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
    expect(applyDocumentCacheControl(html(), header).headers.get('cache-control')).toBe(header)
  })

  it('REFUSES a document that sets a cookie', () => {
    // The safety of the whole feature. A response with Set-Cookie is about one
    // visitor; a shared cache told to reuse it serves their page, session
    // cookie and all, to whoever asks next.
    const response = html()
    response.headers.append('set-cookie', 'session=abc; Path=/; HttpOnly')

    expect(applyDocumentCacheControl(response, header).headers.get('cache-control')).toBeNull()
    expect(applyDocumentCacheControl(response, header).headers.getSetCookie()).toHaveLength(1)
  })

  it('leaves an existing cache-control alone', () => {
    const response = html({ headers: { 'content-type': 'text/html', 'cache-control': 'no-store' } })
    expect(applyDocumentCacheControl(response, header).headers.get('cache-control')).toBe('no-store')
  })

  it('only touches successful HTML', () => {
    const notFound = new Response('nope', { status: 404, headers: { 'content-type': 'text/html' } })
    expect(applyDocumentCacheControl(notFound, header).headers.get('cache-control')).toBeNull()

    const json = new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    expect(applyDocumentCacheControl(json, header).headers.get('cache-control')).toBeNull()
  })

  it('is a no-op when nothing was declared, so the default costs nothing', () => {
    const response = html()
    expect(applyDocumentCacheControl(response, undefined)).toBe(response)
  })

  it('keeps the body intact', async () => {
    const out = applyDocumentCacheControl(html(), header)
    expect(await out.text()).toContain('<!doctype html>')
  })
})
