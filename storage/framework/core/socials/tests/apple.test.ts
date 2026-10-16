import { Buffer } from 'node:buffer'
import { generateKeyPairSync, sign, verify } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { AppleProvider } from '../src/drivers/apple'
import { ConfigException } from '../src/exceptions'
import { clearSigningKeyCache } from '../src/id-token'

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

// Apple signs id_tokens with RS256 and publishes the public half at
// /auth/keys. These tests stand in for both halves, so a token this suite
// builds is a token the driver can actually verify (stacksjs/stacks#2907).
const apple = generateKeyPairSync('rsa', { modulusLength: 2048 })
const appleJwk = apple.publicKey.export({ format: 'jwk' }) as { n: string, e: string }
const APPLE_KID = 'apple-key-1'

const realFetch = globalThis.fetch

beforeEach(() => {
  clearSigningKeyCache()
  globalThis.fetch = (async (url: string) => {
    if (String(url) === 'https://appleid.apple.com/auth/keys') {
      return new Response(
        JSON.stringify({ keys: [{ kty: 'RSA', kid: APPLE_KID, use: 'sig', alg: 'RS256', n: appleJwk.n, e: appleJwk.e }] }),
        { status: 200 },
      )
    }
    throw new Error(`unexpected fetch to ${url}`)
  }) as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

function makeProvider(overrides: Record<string, string> = {}) {
  return new AppleProvider({
    clientId: 'org.example.web',
    clientSecret: '',
    redirectUrl: 'https://example.com/api/auth/sso/apple/callback',
    teamId: 'TEAM123456',
    keyId: 'KEY1234567',
    privateKey: privateKeyPem,
    ...overrides,
  })
}

/** Expose the protected members under test. */
class InspectableAppleProvider extends AppleProvider {
  public clientSecret_(): string {
    return this.generateClientSecret()
  }

}

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

/** An id_token signed the way Apple signs one. */
function appleIdToken(claims: Record<string, unknown>): string {
  const header = b64url({ alg: 'RS256', kid: APPLE_KID, typ: 'JWT' })
  const payload = b64url(claims)
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`), apple.privateKey)
  return `${header}.${payload}.${signature.toString('base64url')}`
}

/** The same claims with a signature nobody produced. */
function forgedIdToken(claims: Record<string, unknown>): string {
  const header = b64url({ alg: 'RS256', kid: APPLE_KID, typ: 'JWT' })
  return `${header}.${b64url(claims)}.${Buffer.from('NOT_A_REAL_SIGNATURE').toString('base64url')}`
}

describe('AppleProvider', () => {
  test('getAuthUrl targets Apple with form_post and the supplied state', async () => {
    const provider = makeProvider()
    const url = new URL(await provider.withState('my-csrf-state').getAuthUrl())

    expect(url.origin).toBe('https://appleid.apple.com')
    expect(url.pathname).toBe('/auth/authorize')
    expect(url.searchParams.get('client_id')).toBe('org.example.web')
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.com/api/auth/sso/apple/callback')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('scope')).toBe('name email')
    expect(url.searchParams.get('state')).toBe('my-csrf-state')
    // scopes present -> Apple mandates form_post
    expect(url.searchParams.get('response_mode')).toBe('form_post')
  })

  test('getAuthUrl passes custom parameters (e.g. nonce) through', async () => {
    const provider = makeProvider().with({ nonce: 'n-123' })
    const url = new URL(await provider.getAuthUrl())
    expect(url.searchParams.get('nonce')).toBe('n-123')
  })

  test('setRedirectUrl overrides the configured redirect', async () => {
    const provider = makeProvider()
    provider.setRedirectUrl('https://other.example.com/cb')
    const url = new URL(await provider.getAuthUrl())
    expect(url.searchParams.get('redirect_uri')).toBe('https://other.example.com/cb')
  })

  test('client secret is a valid ES256 JWT with Apple’s required claims', () => {
    const provider = new InspectableAppleProvider({
      clientId: 'org.example.web',
      clientSecret: '',
      redirectUrl: 'https://example.com/cb',
      teamId: 'TEAM123456',
      keyId: 'KEY1234567',
      privateKey: privateKeyPem,
    })

    const jwt = provider.clientSecret_()
    const [rawHeader, rawPayload, rawSignature] = jwt.split('.')
    const header = JSON.parse(Buffer.from(rawHeader!, 'base64url').toString('utf8'))
    const payload = JSON.parse(Buffer.from(rawPayload!, 'base64url').toString('utf8'))

    expect(header).toEqual({ alg: 'ES256', kid: 'KEY1234567', typ: 'JWT' })
    expect(payload.iss).toBe('TEAM123456')
    expect(payload.sub).toBe('org.example.web')
    expect(payload.aud).toBe('https://appleid.apple.com')
    expect(payload.exp).toBeGreaterThan(payload.iat)

    // Signature must verify against the paired public key in P1363 form.
    const ok = verify(
      'sha256',
      Buffer.from(`${rawHeader}.${rawPayload}`),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      Buffer.from(rawSignature!, 'base64url'),
    )
    expect(ok).toBe(true)
  })

  test('getUserByToken maps valid id_token claims to a SocialUser', async () => {
    const provider = makeProvider()
    const idToken = appleIdToken({
      iss: 'https://appleid.apple.com',
      aud: 'org.example.web',
      exp: Math.floor(Date.now() / 1000) + 300,
      iat: Math.floor(Date.now() / 1000),
      sub: 'apple-sub-001',
      email: 'user@privaterelay.appleid.com',
      email_verified: 'true',
    })

    const user = await provider.getUserByToken(idToken)
    expect(user.id).toBe('apple-sub-001')
    expect(user.email).toBe('user@privaterelay.appleid.com')
    expect(user.emailVerified).toBe(true)
    expect(user.name).toBe('')
    expect(user.nickname).toBeNull()
    expect(user.avatar).toBeNull()
    expect(user.token).toBe(idToken)
  })

  test('getUserByToken rejects wrong issuer, wrong audience, and expired tokens', async () => {
    const provider = makeProvider()
    const base = {
      iss: 'https://appleid.apple.com',
      aud: 'org.example.web',
      exp: Math.floor(Date.now() / 1000) + 300,
      iat: Math.floor(Date.now() / 1000),
      sub: 'apple-sub-001',
    }

    await expect(provider.getUserByToken(appleIdToken({ ...base, iss: 'https://evil.example' }))).rejects.toThrow('issuer is')
    await expect(provider.getUserByToken(appleIdToken({ ...base, aud: 'someone-else' }))).rejects.toThrow('addressed to a different client')
    await expect(provider.getUserByToken(appleIdToken({ ...base, exp: Math.floor(Date.now() / 1000) - 120 }))).rejects.toThrow('expired')
  })

  test('refuses a token Apple did not sign (stacksjs/stacks#2907)', async () => {
    const provider = makeProvider()
    // Everything a forger controls is set to something that would pass the
    // claim checks: the right issuer, our audience, an unexpired window, and
    // the verified email that makes `resolveSocialSignIn` link to an existing
    // account. The only thing missing is Apple's signature.
    const forged = forgedIdToken({
      iss: 'https://appleid.apple.com',
      aud: 'org.example.web',
      exp: Math.floor(Date.now() / 1000) + 600,
      sub: '001234.victimAppleUserId',
      email: 'victim@example.com',
      email_verified: true,
    })

    await expect(provider.getUserByToken(forged)).rejects.toThrow('Apple OAuth error: id_token verification failed')
    await expect(provider.getUserByToken(forged)).rejects.toThrow('signature does not match')
  })

  test('checks the nonce when the caller supplies one', async () => {
    const provider = makeProvider()
    const claims = {
      iss: 'https://appleid.apple.com',
      aud: 'org.example.web',
      exp: Math.floor(Date.now() / 1000) + 300,
      sub: 'apple-sub-001',
      nonce: 'the-real-nonce',
    }

    expect((await provider.getUserByToken(appleIdToken(claims), { nonce: 'the-real-nonce' })).id).toBe('apple-sub-001')
    await expect(provider.getUserByToken(appleIdToken(claims), { nonce: 'a-different-nonce' })).rejects.toThrow('nonce does not match')
    // No expectation supplied, no nonce check: the web flow may not use one.
    expect((await provider.getUserByToken(appleIdToken(claims))).id).toBe('apple-sub-001')
  })

  test('getUserByToken rejects malformed tokens', async () => {
    await expect(makeProvider().getUserByToken('not-a-jwt')).rejects.toThrow('malformed token')
  })

  test('validateConfig demands the Apple signing inputs', async () => {
    await expect(makeProvider({ teamId: '' }).getAuthUrl()).rejects.toThrow(ConfigException)
    await expect(makeProvider({ keyId: '' }).getAuthUrl()).rejects.toThrow(ConfigException)
    await expect(makeProvider({ privateKey: '' }).getAuthUrl()).rejects.toThrow(ConfigException)
  })

  test('normalizes escaped newlines in env-provided private keys', () => {
    const escaped = privateKeyPem.replace(/\n/g, '\\n')
    const provider = new InspectableAppleProvider({
      clientId: 'org.example.web',
      clientSecret: '',
      redirectUrl: 'https://example.com/cb',
      teamId: 'TEAM123456',
      keyId: 'KEY1234567',
      privateKey: escaped,
    })
    expect(provider.clientSecret_().split('.')).toHaveLength(3)
  })
})

describe('AppleProvider for an app\'s own sheet', () => {
  function nativeProvider() {
    return new InspectableAppleProvider({
      clientId: 'org.example.app', clientSecret: '', redirectUrl: '', native: true,
      teamId: 'TEAM123456', keyId: 'KEY1234567', privateKey: privateKeyPem,
    })
  }

  test('redeems the code as the app, with no redirect_uri', async () => {
    const originalFetch = globalThis.fetch
    let sent: URLSearchParams | null = null
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      sent = init.body as URLSearchParams
      return new Response(JSON.stringify({ id_token: 'id.token.here' }), { status: 200 })
    }) as unknown as typeof fetch
    try {
      expect(await nativeProvider().getAccessToken('app-code')).toBe('id.token.here')
    }
    finally {
      globalThis.fetch = originalFetch
    }
    expect(sent!.get('client_id')).toBe('org.example.app')
    expect(sent!.get('code')).toBe('app-code')
    expect(sent!.has('redirect_uri')).toBe(false)
    // The client secret names the app as its subject.
    const payload = JSON.parse(Buffer.from(sent!.get('client_secret')!.split('.')[1]!, 'base64url').toString('utf8'))
    expect(payload.sub).toBe('org.example.app')
  })

  test('takes only tokens issued to the app', async () => {
    const claims = { iss: 'https://appleid.apple.com', exp: Math.floor(Date.now() / 1000) + 300, sub: 'apple-sub-002' }
    expect((await nativeProvider().getUserByToken(appleIdToken({ ...claims, aud: 'org.example.app' }))).id).toBe('apple-sub-002')
    await expect(nativeProvider().getUserByToken(appleIdToken({ ...claims, aud: 'org.example.web' }))).rejects.toThrow('addressed to a different client')
  })

  test('has no web flow', async () => {
    await expect(nativeProvider().getAuthUrl()).rejects.toThrow(ConfigException)
  })
})

describe('AbstractProvider.withState', () => {
  test('rejects empty state', () => {
    expect(() => makeProvider().withState('')).toThrow('non-empty')
  })

  test('a fresh random state is used when none is supplied', async () => {
    const first = new URL(await makeProvider().getAuthUrl()).searchParams.get('state')
    const second = new URL(await makeProvider().getAuthUrl()).searchParams.get('state')
    expect(first).toBeTruthy()
    expect(second).toBeTruthy()
    expect(first).not.toBe(second)
  })
})
