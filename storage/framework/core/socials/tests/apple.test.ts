import { Buffer } from 'node:buffer'
import { generateKeyPairSync, verify } from 'node:crypto'
import { describe, expect, test } from 'bun:test'
import { AppleProvider } from '../src/drivers/apple'
import { ConfigException } from '../src/exceptions'

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

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

  public decode_(idToken: string) {
    return this.decodeIdToken(idToken)
  }
}

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function fakeIdToken(claims: Record<string, unknown>): string {
  return `${b64url({ alg: 'RS256' })}.${b64url(claims)}.${Buffer.from('sig').toString('base64url')}`
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
    const idToken = fakeIdToken({
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

    await expect(provider.getUserByToken(fakeIdToken({ ...base, iss: 'https://evil.example' }))).rejects.toThrow('iss/aud/exp')
    await expect(provider.getUserByToken(fakeIdToken({ ...base, aud: 'someone-else' }))).rejects.toThrow('iss/aud/exp')
    await expect(provider.getUserByToken(fakeIdToken({ ...base, exp: Math.floor(Date.now() / 1000) - 10 }))).rejects.toThrow('iss/aud/exp')
  })

  test('decodeIdToken rejects malformed tokens', () => {
    const provider = new InspectableAppleProvider({
      clientId: 'a',
      clientSecret: '',
      redirectUrl: 'https://example.com/cb',
      teamId: 't',
      keyId: 'k',
      privateKey: privateKeyPem,
    })
    expect(() => provider.decode_('not-a-jwt')).toThrow('malformed id_token')
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
