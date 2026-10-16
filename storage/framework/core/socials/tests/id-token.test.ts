import { Buffer } from 'node:buffer'
import { generateKeyPairSync, sign } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { clearSigningKeyCache, verifyIdToken } from '../src/id-token'

// stacksjs/stacks#2907 — a JWT's payload is public, so claims are only worth
// what the signature over them is worth. These pin that the signature is
// actually checked, because the bug being fixed is that it never was.

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = publicKey.export({ format: 'jwk' }) as { n: string, e: string }

// A second, unrelated key: an attacker's, for a token signed by the wrong hand.
const other = generateKeyPairSync('rsa', { modulusLength: 2048 })

const JWKS_URL = 'https://issuer.example/keys'
const ISSUER = 'https://issuer.example'
const AUDIENCE = 'com.example.app'
const NOW = 1_760_000_000_000

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function signedToken(
  claims: Record<string, unknown>,
  options: { kid?: string, alg?: string, key?: typeof privateKey, signature?: string } = {},
): string {
  const header = b64url({ alg: options.alg ?? 'RS256', kid: options.kid ?? 'key-1', typ: 'JWT' })
  const payload = b64url(claims)
  if (options.signature !== undefined)
    return `${header}.${payload}.${options.signature}`
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`), options.key ?? privateKey)
  return `${header}.${payload}.${signature.toString('base64url')}`
}

function validClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: ISSUER,
    aud: AUDIENCE,
    sub: 'subject-001',
    exp: Math.floor(NOW / 1000) + 600,
    iat: Math.floor(NOW / 1000) - 10,
    ...overrides,
  }
}

let fetchCount = 0
let served: Array<{ kid: string, n: string, e: string }> = []
const originalFetch = globalThis.fetch

beforeEach(() => {
  clearSigningKeyCache()
  fetchCount = 0
  served = [{ kid: 'key-1', n: jwk.n, e: jwk.e }]
  globalThis.fetch = (async (url: string) => {
    if (String(url) !== JWKS_URL)
      throw new Error(`unexpected fetch to ${url}`)
    fetchCount++
    return new Response(JSON.stringify({ keys: served.map(k => ({ kty: 'RSA', use: 'sig', alg: 'RS256', ...k })) }), { status: 200 })
  }) as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

const verify = (token: string, overrides: Record<string, unknown> = {}) => verifyIdToken(token, {
  jwksUrl: JWKS_URL,
  issuer: ISSUER,
  audience: AUDIENCE,
  now: NOW,
  ...overrides,
})

describe('verifyIdToken', () => {
  test('accepts a token signed by the issuer\'s published key', async () => {
    const claims = await verify(signedToken(validClaims()))
    expect(claims.sub).toBe('subject-001')
    expect(claims.iss).toBe(ISSUER)
  })

  test('rejects the forged token from stacksjs/stacks#2907', async () => {
    // Exactly the proof of concept on the issue: real-looking claims, a
    // signature that is not one.
    const forged = signedToken(
      validClaims({ sub: '001234.victimAppleUserId', email: 'victim@example.com', email_verified: true }),
      { signature: Buffer.from('NOT_A_REAL_SIGNATURE').toString('base64url') },
    )
    await expect(verify(forged)).rejects.toThrow('signature does not match')
  })

  test('rejects a token signed with a key the issuer does not publish', async () => {
    await expect(verify(signedToken(validClaims(), { key: other.privateKey }))).rejects.toThrow('signature does not match')
  })

  test('refuses alg none and alg HS256 rather than accommodating them', async () => {
    await expect(verify(signedToken(validClaims(), { alg: 'none', signature: '' }))).rejects.toThrow('unsupported algorithm')
    await expect(verify(signedToken(validClaims(), { alg: 'HS256' }))).rejects.toThrow('unsupported algorithm')
  })

  test('rejects a header with no kid, and a kid nothing matches', async () => {
    const noKid = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url(validClaims())}.sig`
    await expect(verify(noKid)).rejects.toThrow('no kid')
    await expect(verify(signedToken(validClaims(), { kid: 'key-9' }))).rejects.toThrow('no signing key matches')
  })

  test('rejects a malformed token', async () => {
    await expect(verify('not-a-jwt')).rejects.toThrow('malformed token')
  })

  test('checks issuer, audience and nonce against what was expected', async () => {
    await expect(verify(signedToken(validClaims({ iss: 'https://evil.example' })))).rejects.toThrow('issuer is')
    await expect(verify(signedToken(validClaims({ aud: 'com.someone.else' })))).rejects.toThrow('addressed to a different client')
    await expect(verify(signedToken(validClaims({ nonce: 'wrong' })), { nonce: 'expected' })).rejects.toThrow('nonce does not match')
    // An audience array is satisfied by any one of its entries.
    expect((await verify(signedToken(validClaims({ aud: ['other', AUDIENCE] })))).sub).toBe('subject-001')
  })

  test('accepts any one of several issuers, and still refuses the rest', async () => {
    // Google publishes the same tokens under two spellings of its issuer.
    const both = ['accounts.example', ISSUER]
    expect((await verify(signedToken(validClaims({ iss: 'accounts.example' })), { issuer: both })).sub).toBe('subject-001')
    expect((await verify(signedToken(validClaims()), { issuer: both })).sub).toBe('subject-001')
    await expect(verify(signedToken(validClaims({ iss: 'https://evil.example' })), { issuer: both })).rejects.toThrow('issuer is')
  })

  test('checks exp, iat and nbf, allowing for clock skew', async () => {
    const second = 1000
    await expect(verify(signedToken(validClaims({ exp: Math.floor(NOW / 1000) - 120 })))).rejects.toThrow('expired')
    await expect(verify(signedToken(validClaims({ iat: Math.floor(NOW / 1000) + 600 })))).rejects.toThrow('issued in the future')
    await expect(verify(signedToken(validClaims({ nbf: Math.floor(NOW / 1000) + 600 })))).rejects.toThrow('not valid yet')

    // Just-expired inside the default 60s allowance still passes.
    const justExpired = signedToken(validClaims({ exp: Math.floor((NOW - 30 * second) / 1000) }))
    expect((await verify(justExpired)).sub).toBe('subject-001')
  })

  test('requires a subject', async () => {
    await expect(verify(signedToken(validClaims({ sub: '' })))).rejects.toThrow('no subject')
  })

  test('fetches the key set once and reuses it', async () => {
    await verify(signedToken(validClaims()))
    await verify(signedToken(validClaims()))
    expect(fetchCount).toBe(1)
  })

  test('refetches after a rotation, but not often enough to be a lever', async () => {
    await verify(signedToken(validClaims()))
    expect(fetchCount).toBe(1)

    // The issuer rotates: same cached set, a kid it has never seen.
    served = [{ kid: 'key-2', n: jwk.n, e: jwk.e }]
    const rotated = signedToken(validClaims(), { kid: 'key-2' })

    // Immediately after the first fetch, an unknown kid is refused without
    // reaching for the network again.
    await expect(verify(rotated)).rejects.toThrow('no signing key matches')
    expect(fetchCount).toBe(1)

    // Once the floor has passed, the rotation is picked up.
    expect((await verify(rotated, { now: NOW + 61_000 })).sub).toBe('subject-001')
    expect(fetchCount).toBe(2)
  })

  test('surfaces a JWKS endpoint that is not answering', async () => {
    globalThis.fetch = (async () => new Response('nope', { status: 503 })) as unknown as typeof fetch
    await expect(verify(signedToken(validClaims()))).rejects.toThrow('could not fetch signing keys')
  })
})
