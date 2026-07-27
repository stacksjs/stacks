/**
 * Tests for the browser CSRF token plumbing.
 *
 * Regression focus: the CSRF middleware is default-on for unsafe methods and
 * expects the client to echo the `X-CSRF-Token` cookie back as a header. The
 * browser package never did, so a stock install answered 403 "CSRF token
 * mismatch" to its own login, register and logout requests.
 */

import { describe, expect, it } from 'bun:test'
import { CSRF_COOKIE_NAME, readCsrfToken, withCsrfHeader } from '../src/composables/csrf'

describe('readCsrfToken', () => {
  it('reads the token from a single-cookie jar', () => {
    expect(readCsrfToken('X-CSRF-Token=abc123')).toBe('abc123')
  })

  it('finds the token among other cookies', () => {
    expect(readCsrfToken('theme=dark; X-CSRF-Token=abc123; other=1')).toBe('abc123')
  })

  it('does not match a cookie that merely ends with the name', () => {
    expect(readCsrfToken('NOT-X-CSRF-Token=nope')).toBeNull()
  })

  it('percent-decodes the value', () => {
    expect(readCsrfToken('X-CSRF-Token=a%2Bb%3Dc')).toBe('a+b=c')
  })

  it('returns null for an empty jar or an empty value', () => {
    expect(readCsrfToken('')).toBeNull()
    expect(readCsrfToken('X-CSRF-Token=')).toBeNull()
  })

  it('tolerates malformed cookie fragments', () => {
    expect(readCsrfToken('junk; X-CSRF-Token=abc123')).toBe('abc123')
  })
})

describe('withCsrfHeader', () => {
  it('adds the header when a token is present', () => {
    const headers = withCsrfHeader({ 'Content-Type': 'application/json' }, 'X-CSRF-Token=abc123')

    expect(headers[CSRF_COOKIE_NAME]).toBe('abc123')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('leaves headers untouched when there is no cookie', () => {
    const original = { 'Content-Type': 'application/json' }
    const headers = withCsrfHeader(original, '')

    expect(headers).toEqual(original)
    expect(headers[CSRF_COOKIE_NAME]).toBeUndefined()
  })

  it('never overwrites a caller-supplied token', () => {
    const headers = withCsrfHeader(
      { [CSRF_COOKIE_NAME]: 'explicit' },
      'X-CSRF-Token=from-cookie',
    )

    expect(headers[CSRF_COOKIE_NAME]).toBe('explicit')
  })

  it('does not mutate the headers it was given', () => {
    const original: Record<string, string> = { Accept: 'application/json' }
    withCsrfHeader(original, 'X-CSRF-Token=abc123')

    expect(original[CSRF_COOKIE_NAME]).toBeUndefined()
  })

  it('defaults to an empty header set', () => {
    expect(withCsrfHeader(undefined, 'X-CSRF-Token=abc123')[CSRF_COOKIE_NAME]).toBe('abc123')
  })
})
