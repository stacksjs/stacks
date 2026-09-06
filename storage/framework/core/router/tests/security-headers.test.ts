import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import process from 'node:process'
import { __resetSecurityHeadersCache, applySecurityHeaders, applySecurityHeadersToRecord, createSecurityHeaders } from '../src/security-headers'

// stacksjs/stacks#601 — HSTS + companion security headers on every response.

describe('applySecurityHeaders', () => {
  const originalAppEnv = process.env.APP_ENV
  const originalNodeEnv = process.env.NODE_ENV
  const originalDisable = process.env.STACKS_SECURITY_HEADERS_DISABLE
  const originalCsp = process.env.STACKS_CSP
  const originalCspReportOnly = process.env.STACKS_CSP_REPORT_ONLY

  beforeEach(() => {
    __resetSecurityHeadersCache()
    delete process.env.STACKS_SECURITY_HEADERS_DISABLE
    delete process.env.STACKS_CSP
    delete process.env.STACKS_CSP_REPORT_ONLY
  })

  afterEach(() => {
    if (originalAppEnv === undefined) delete process.env.APP_ENV
    else process.env.APP_ENV = originalAppEnv
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
    if (originalDisable === undefined) delete process.env.STACKS_SECURITY_HEADERS_DISABLE
    else process.env.STACKS_SECURITY_HEADERS_DISABLE = originalDisable
    if (originalCsp === undefined) delete process.env.STACKS_CSP
    else process.env.STACKS_CSP = originalCsp
    if (originalCspReportOnly === undefined) delete process.env.STACKS_CSP_REPORT_ONLY
    else process.env.STACKS_CSP_REPORT_ONLY = originalCspReportOnly
    __resetSecurityHeadersCache()
  })

  test('sets the always-on triad on every response', () => {
    delete process.env.APP_ENV
    delete process.env.NODE_ENV
    __resetSecurityHeadersCache()
    const h = new Headers()
    applySecurityHeaders(h)
    expect(h.get('X-Content-Type-Options')).toBe('nosniff')
    expect(h.get('X-Frame-Options')).toBe('SAMEORIGIN')
    expect(h.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })

  test('sets HSTS only when APP_ENV=production', () => {
    process.env.APP_ENV = 'production'
    __resetSecurityHeadersCache()
    const h = new Headers()
    applySecurityHeaders(h)
    expect(h.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains')
  })

  test('falls back to NODE_ENV when APP_ENV is unset', () => {
    delete process.env.APP_ENV
    process.env.NODE_ENV = 'production'
    __resetSecurityHeadersCache()
    const h = new Headers()
    applySecurityHeaders(h)
    expect(h.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains')
  })

  test('APP_ENV wins over NODE_ENV', () => {
    process.env.APP_ENV = 'staging'
    process.env.NODE_ENV = 'production'
    __resetSecurityHeadersCache()
    const h = new Headers()
    applySecurityHeaders(h)
    expect(h.get('Strict-Transport-Security')).toBeNull()
  })

  test('does not send HSTS in development', () => {
    process.env.APP_ENV = 'development'
    __resetSecurityHeadersCache()
    const h = new Headers()
    applySecurityHeaders(h)
    expect(h.get('Strict-Transport-Security')).toBeNull()
    // Triad still applied
    expect(h.get('X-Content-Type-Options')).toBe('nosniff')
  })

  test('does not overwrite headers the caller already set', () => {
    process.env.APP_ENV = 'production'
    __resetSecurityHeadersCache()
    const h = new Headers({
      'X-Frame-Options': 'DENY',
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
      'Referrer-Policy': 'no-referrer',
    })
    applySecurityHeaders(h)
    expect(h.get('X-Frame-Options')).toBe('DENY')
    expect(h.get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains; preload')
    expect(h.get('Referrer-Policy')).toBe('no-referrer')
    // nosniff was not set, so we still apply it
    expect(h.get('X-Content-Type-Options')).toBe('nosniff')
  })

  test('STACKS_SECURITY_HEADERS_DISABLE=true short-circuits everything', () => {
    process.env.APP_ENV = 'production'
    process.env.STACKS_SECURITY_HEADERS_DISABLE = 'true'
    __resetSecurityHeadersCache()
    const h = new Headers()
    applySecurityHeaders(h)
    expect(h.get('X-Content-Type-Options')).toBeNull()
    expect(h.get('X-Frame-Options')).toBeNull()
    expect(h.get('Referrer-Policy')).toBeNull()
    expect(h.get('Strict-Transport-Security')).toBeNull()
  })

  test('adds production defaults to a fresh response-init record', () => {
    process.env.APP_ENV = 'production'
    process.env.STACKS_CSP = "default-src 'self'"
    __resetSecurityHeadersCache()
    const headers: Record<string, string> = { Link: '</next>; rel="next"' }

    applySecurityHeadersToRecord(headers)

    expect(headers.Link).toBe('</next>; rel="next"')
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['X-Frame-Options']).toBe('SAMEORIGIN')
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains')
    expect(headers['Content-Security-Policy']).toBe("default-src 'self'")
  })

  test('leaves a fresh response-init record alone when disabled', () => {
    process.env.STACKS_SECURITY_HEADERS_DISABLE = 'true'
    __resetSecurityHeadersCache()
    const headers: Record<string, string> = { Link: '</next>; rel="next"' }

    applySecurityHeadersToRecord(headers)

    expect(headers).toEqual({ Link: '</next>; rel="next"' })
  })

  test('clones the resolved header template', () => {
    process.env.APP_ENV = 'production'
    __resetSecurityHeadersCache()
    const first = createSecurityHeaders()
    first.set('X-Frame-Options', 'DENY')

    const second = createSecurityHeaders()
    expect(second.get('X-Frame-Options')).toBe('SAMEORIGIN')
    expect(second.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains')
  })
})
