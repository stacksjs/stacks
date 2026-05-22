import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import process from 'node:process'
import { signedUrl, signUrl, verifySignedUrl } from '../src/signed-url'
import { createStacksRouter } from '../src/stacks-router'

// Regression coverage for stacksjs/stacks#1870 R-7. Each test sets a
// fixed APP_KEY so the signing secret is deterministic; the afterEach
// restores the environment to avoid leakage into unrelated tests.

const ORIGINAL_APP_KEY = process.env.APP_KEY
const ORIGINAL_APP_URL = process.env.APP_URL
const ORIGINAL_SIGN_SECRET = process.env.STACKS_SIGNED_URL_SECRET

beforeEach(() => {
  process.env.APP_KEY = 'test-app-key-with-enough-length-for-signing'
  process.env.APP_URL = 'https://example.test'
  delete process.env.STACKS_SIGNED_URL_SECRET
})

afterEach(() => {
  if (ORIGINAL_APP_KEY === undefined) delete process.env.APP_KEY
  else process.env.APP_KEY = ORIGINAL_APP_KEY
  if (ORIGINAL_APP_URL === undefined) delete process.env.APP_URL
  else process.env.APP_URL = ORIGINAL_APP_URL
  if (ORIGINAL_SIGN_SECRET === undefined) delete process.env.STACKS_SIGNED_URL_SECRET
  else process.env.STACKS_SIGNED_URL_SECRET = ORIGINAL_SIGN_SECRET
})

describe('signUrl + verifySignedUrl (stacksjs/stacks#1870 R-7)', () => {
  test('signed → verified round-trip', () => {
    const signed = signUrl('/api/email/verify?user=42')
    const result = verifySignedUrl(signed)
    expect(result.valid).toBe(true)
  })

  test('tampering with the query string invalidates the signature', () => {
    const signed = signUrl('/api/email/verify?user=42')
    const u = new URL(signed)
    u.searchParams.set('user', '99')
    const result = verifySignedUrl(u.toString())
    expect(result.valid).toBe(false)
    expect(result.valid ? null : result.reason).toBe('invalid-signature')
  })

  test('missing signature param returns missing-signature', () => {
    const result = verifySignedUrl('https://example.test/api/email/verify?user=42')
    expect(result.valid).toBe(false)
    expect(result.valid ? null : result.reason).toBe('missing-signature')
  })

  test('expired URL returns expired (not invalid-signature)', () => {
    const signed = signUrl('/api/email/verify?user=42', { ttl: -10 })
    const result = verifySignedUrl(signed)
    expect(result.valid).toBe(false)
    expect(result.valid ? null : result.reason).toBe('expired')
  })

  test('expiry inside the window is still valid', () => {
    const signed = signUrl('/api/email/verify?user=42', { ttl: 60 })
    const result = verifySignedUrl(signed)
    expect(result.valid).toBe(true)
  })

  test('query-param order does not affect the signature', () => {
    // Sign with one ordering, verify after re-ordering by URL constructor.
    // Internal canonicalisation (searchParams.sort) should make both equal.
    const signed1 = signUrl('/x?a=1&b=2')
    const signed2 = signUrl('/x?b=2&a=1')
    expect(verifySignedUrl(signed1).valid).toBe(true)
    expect(verifySignedUrl(signed2).valid).toBe(true)
  })

  test('signedUrl(routeName) + verify works end-to-end', () => {
    const router = createStacksRouter()
    router.get('/api/email/verify', () => new Response('ok')).name('email.verify')
    const link = signedUrl('email.verify', { user: 7 }, { ttl: 300 })
    expect(link).toContain('signature=')
    expect(verifySignedUrl(link).valid).toBe(true)
  })

  test('signing without APP_KEY (and without secret env) throws', () => {
    delete process.env.APP_KEY
    delete process.env.STACKS_SIGNED_URL_SECRET
    expect(() => signUrl('/x')).toThrow(/APP_KEY/)
  })
})
