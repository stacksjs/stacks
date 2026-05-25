import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import process from 'node:process'
import { __resetSecurityHeadersCache, applySecurityHeaders } from '../src/security-headers'

// stacksjs/stacks#601 — HSTS + companion security headers on every response.

describe('applySecurityHeaders', () => {
  const originalAppEnv = process.env.APP_ENV
  const originalNodeEnv = process.env.NODE_ENV
  const originalDisable = process.env.STACKS_SECURITY_HEADERS_DISABLE

  beforeEach(() => {
    __resetSecurityHeadersCache()
    delete process.env.STACKS_SECURITY_HEADERS_DISABLE
  })

  afterEach(() => {
    if (originalAppEnv === undefined) delete process.env.APP_ENV
    else process.env.APP_ENV = originalAppEnv
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
    if (originalDisable === undefined) delete process.env.STACKS_SECURITY_HEADERS_DISABLE
    else process.env.STACKS_SECURITY_HEADERS_DISABLE = originalDisable
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
})
