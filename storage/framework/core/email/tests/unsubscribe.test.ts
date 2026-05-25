import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import process from 'node:process'
import {
  buildListUnsubscribeHeaders,
  buildUnsubscribeUrl,
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from '../src/unsubscribe'

// stacksjs/stacks#1880 — signed unsubscribe tokens.

const ORIGINAL_APP_KEY = process.env.APP_KEY
const ORIGINAL_APP_URL = process.env.APP_URL

beforeAll(() => {
  process.env.APP_KEY = 'test-key-must-be-at-least-16-chars'
  process.env.APP_URL = 'https://example.com'
})

afterAll(() => {
  if (ORIGINAL_APP_KEY === undefined) delete process.env.APP_KEY
  else process.env.APP_KEY = ORIGINAL_APP_KEY
  if (ORIGINAL_APP_URL === undefined) delete process.env.APP_URL
  else process.env.APP_URL = ORIGINAL_APP_URL
})

describe('createUnsubscribeToken + verifyUnsubscribeToken', () => {
  test('mints + verifies a valid token round-trip', () => {
    const token = createUnsubscribeToken('user@example.com', 3600)
    const result = verifyUnsubscribeToken(token)
    expect(result.valid).toBe(true)
    expect(result.email).toBe('user@example.com')
  })

  test('email is canonicalized (lowercased + trimmed)', () => {
    const token = createUnsubscribeToken('  USER@Example.COM  ', 3600)
    const result = verifyUnsubscribeToken(token)
    expect(result.email).toBe('user@example.com')
  })

  test('rejects an expired token', () => {
    const token = createUnsubscribeToken('user@example.com', -1) // already expired
    const result = verifyUnsubscribeToken(token)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('expired')
  })

  test('rejects a token signed with a different key', () => {
    const token = createUnsubscribeToken('user@example.com', 3600)
    process.env.APP_KEY = 'a-different-key-also-16-chars-or-more'
    const result = verifyUnsubscribeToken(token)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('bad_signature')
    // Restore for other tests in the file
    process.env.APP_KEY = 'test-key-must-be-at-least-16-chars'
  })

  test('rejects a malformed token', () => {
    expect(verifyUnsubscribeToken('not-a-token').reason).toBe('malformed')
    expect(verifyUnsubscribeToken('a.b.c').reason).toBe('malformed')
    expect(verifyUnsubscribeToken('').reason).toBe('malformed')
  })

  test('refuses to mint without an email', () => {
    expect(() => createUnsubscribeToken('', 3600)).toThrow()
  })

  test('rejects bit-flipped payload (signature mismatch)', () => {
    const token = createUnsubscribeToken('user@example.com', 3600)
    const [payload, sig] = token.split('.')
    // Tamper with the payload — flip the last char to something else
    const tampered = `${payload!.slice(0, -1)}${payload!.slice(-1) === 'A' ? 'B' : 'A'}.${sig}`
    expect(verifyUnsubscribeToken(tampered).valid).toBe(false)
  })
})

describe('buildUnsubscribeUrl', () => {
  test('combines APP_URL + default route + token', () => {
    const url = buildUnsubscribeUrl('user@example.com', 3600)
    expect(url.startsWith('https://example.com/_stacks/email/unsubscribe/')).toBe(true)
    // Extract the token from the URL and verify it round-trips
    const token = url.slice('https://example.com/_stacks/email/unsubscribe/'.length)
    expect(verifyUnsubscribeToken(token).valid).toBe(true)
  })

  test('honors options.baseUrl + options.routePrefix override', () => {
    const url = buildUnsubscribeUrl('user@example.com', 3600, {
      baseUrl: 'https://other.example.com',
      routePrefix: '/opt-out',
    })
    expect(url.startsWith('https://other.example.com/opt-out/')).toBe(true)
  })

  test('strips trailing slash from baseUrl', () => {
    const url = buildUnsubscribeUrl('user@example.com', 3600, { baseUrl: 'https://example.com/' })
    expect(url).toMatch(/^https:\/\/example\.com\//)
    expect(url).not.toMatch(/^https:\/\/example\.com\/\//)
  })
})

describe('buildListUnsubscribeHeaders', () => {
  test('emits the RFC 8058 header pair', () => {
    const headers = buildListUnsubscribeHeaders('user@example.com', 3600)
    expect(headers['List-Unsubscribe']).toMatch(/^<https:\/\/example\.com\/_stacks\/email\/unsubscribe\/[^>]+>$/)
    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })
})
