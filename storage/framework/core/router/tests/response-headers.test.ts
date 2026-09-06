/**
 * Headers a middleware asked to have on the response.
 *
 * The middleware pipeline is pre-action only, so a middleware with something to
 * say *about the answer* - a rate limit's remaining count, a cache verdict, a
 * deprecation notice - had nowhere to put it. Compression got a hard-coded
 * post-action wrapper keyed on a `_compress` marker; everything else got
 * nothing, and the workaround in an app is to wrap every action it has.
 *
 * Driven through a real server rather than by calling the header builder,
 * because the claim is about what arrives at a client.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

let server: any = null
let port = 0

beforeAll(async () => {
  const { route } = await import('../src')

  route.get('/_mw_headers', (request: any) => {
    // What a middleware would have done in its `handle`, done here because the
    // point under test is the router applying it rather than who wrote it.
    request._responseHeaders = { 'X-RateLimit-Remaining': '41', 'X-Custom': 'yes' }

    return new Response('ok', { status: 200 })
  })

  route.get('/_mw_headers_collide', (request: any) => {
    // A request that genuinely has an id, which is the only case where there is
    // anything to collide with.
    request._requestId = 'the-router-owns-this'
    request._responseHeaders = { 'X-Request-ID': 'a-middleware-wrote-this' }

    return new Response('ok', { status: 200 })
  })

  route.get('/_mw_headers_security_override', (request: any) => {
    request._responseHeaders = { 'X-Frame-Options': 'DENY' }

    return { ok: true }
  })

  server = await route.serve({ port: 0, hostname: '127.0.0.1' })
  port = Number(server?.port ?? server?.server?.port ?? 0)
})

afterAll(() => {
  server?.stop?.()
})

describe('_responseHeaders', () => {
  it('lands on the response', async () => {
    const answer = await fetch(`http://127.0.0.1:${port}/_mw_headers`)

    expect(answer.headers.get('X-RateLimit-Remaining')).toBe('41')
    expect(answer.headers.get('X-Custom')).toBe('yes')
  })

  it('does not disturb the body or the status', async () => {
    const answer = await fetch(`http://127.0.0.1:${port}/_mw_headers`)

    expect(answer.status).toBe(200)
    expect(await answer.text()).toBe('ok')
  })

  it('loses to the router on a collision', async () => {
    /*
     * `X-Request-ID` is this layer's to state: it is what stitches a response
     * to its log lines, and a middleware overwriting it breaks correlation for
     * everybody downstream.
     */
    const answer = await fetch(`http://127.0.0.1:${port}/_mw_headers_collide`)

    expect(answer.headers.get('X-Request-ID')).toBe('the-router-owns-this')
  })

  it('can override a security default on a framework-created response', async () => {
    const answer = await fetch(`http://127.0.0.1:${port}/_mw_headers_security_override`)

    expect(answer.headers.get('X-Frame-Options')).toBe('DENY')
  })
})
