import { describe, expect, test } from 'bun:test'
import { applyRequestEnhancements } from '@stacksjs/bun-router'

// Regression coverage for the request-helper attachment that the auth
// middleware and ~100 default actions depend on. Pins the contract that
// `applyRequestEnhancements()` works on a bare Request outside of
// `route.serve()` — without it, callers that build their own Request
// (test harnesses, pre-flight middleware) hit a runtime TypeError on
// `request.bearerToken()`.

describe('applyRequestEnhancements', () => {
  test('attaches bearerToken() that reads Authorization header', () => {
    const req = new Request('https://example.com/x', {
      headers: { Authorization: 'Bearer abc123' },
    })
    const enhanced = applyRequestEnhancements(req)
    expect(typeof (enhanced as any).bearerToken).toBe('function')
    expect((enhanced as any).bearerToken()).toBe('abc123')
  })

  test('attaches bearerToken() returning null when no Authorization', () => {
    const req = new Request('https://example.com/x')
    const enhanced = applyRequestEnhancements(req)
    expect((enhanced as any).bearerToken()).toBe(null)
  })

  test('attaches getParam() that reads route params', () => {
    const req = new Request('https://example.com/x')
    const enhanced = applyRequestEnhancements(req, { id: '42' })
    expect((enhanced as any).getParam('id')).toBe('42')
    expect((enhanced as any).getParam('missing', 'fallback')).toBe('fallback')
  })

  test('attaches cookie() that reads named cookies', () => {
    const req = new Request('https://example.com/x', {
      headers: { Cookie: 'session_id=xyz; theme=dark' },
    })
    const enhanced = applyRequestEnhancements(req)
    expect(typeof (enhanced as any).cookie).toBe('function')
    expect((enhanced as any).cookie('session_id')).toBe('xyz')
    expect((enhanced as any).cookie('theme')).toBe('dark')
    expect((enhanced as any).cookie('missing')).toBe(null)
    expect((enhanced as any).cookie('missing', 'default')).toBe('default')
  })

  test('attaches get() that reads query string', () => {
    const req = new Request('https://example.com/x?name=alice&page=2')
    const enhanced = applyRequestEnhancements(req)
    expect(typeof (enhanced as any).get).toBe('function')
    expect((enhanced as any).get('name')).toBe('alice')
    expect((enhanced as any).get('page')).toBe('2')
  })

  test('is idempotent — running twice does not break the helpers', () => {
    const req = new Request('https://example.com/x', {
      headers: { Authorization: 'Bearer once' },
    })
    const a = applyRequestEnhancements(req, { id: '1' })
    const b = applyRequestEnhancements(a as unknown as Request, { id: '1' })
    expect((b as any).bearerToken()).toBe('once')
    expect((b as any).getParam('id')).toBe('1')
    // Returning the same object the second time matters because some
    // call sites stash the result on the request and would duplicate
    // attachments otherwise.
    expect(b).toBe(a)
  })

  test('exposes params on the enhanced request', () => {
    const req = new Request('https://example.com/x')
    const enhanced = applyRequestEnhancements(req, { foo: 'bar', baz: 'qux' })
    expect((enhanced as any).params).toEqual({ foo: 'bar', baz: 'qux' })
  })
})
