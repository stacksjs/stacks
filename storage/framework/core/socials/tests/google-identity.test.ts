import { Buffer } from 'node:buffer'
import { generateKeyPairSync, sign } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { GoogleProvider } from '../src/drivers/google'
import { clearSigningKeyCache } from '../src/id-token'

/**
 * stacksjs/stacks#2907 — `/userinfo` answers for an access token issued to
 * ANY client, so trusting it without checking the audience lets a token
 * minted by the attacker's own OAuth app resolve to an account of their
 * choosing. These pin the audience check, and the verified id_token path
 * that avoids needing it.
 */

const CLIENT_ID = 'ours.apps.googleusercontent.com'
const TOKENINFO = 'https://oauth2.googleapis.com/tokeninfo'
const CERTS = 'https://www.googleapis.com/oauth2/v3/certs'
const KID = 'google-key-1'

const google = generateKeyPairSync('rsa', { modulusLength: 2048 })
const googleJwk = google.publicKey.export({ format: 'jwk' }) as { n: string, e: string }

const realFetch = globalThis.fetch

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function googleIdToken(claims: Record<string, unknown>, signature?: string): string {
  const header = b64url({ alg: 'RS256', kid: KID, typ: 'JWT' })
  const payload = b64url(claims)
  if (signature !== undefined)
    return `${header}.${payload}.${Buffer.from(signature).toString('base64url')}`
  return `${header}.${payload}.${sign('sha256', Buffer.from(`${header}.${payload}`), google.privateKey).toString('base64url')}`
}

function validClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: 'google-sub-001',
    exp: Math.floor(Date.now() / 1000) + 600,
    email: 'user@example.com',
    email_verified: true,
    name: 'A User',
    given_name: 'A',
    picture: 'https://example.com/a.png',
    ...overrides,
  }
}

function provider(): GoogleProvider {
  return new GoogleProvider({ clientId: CLIENT_ID, clientSecret: 'secret', redirectUrl: 'https://example.com/cb' })
}

/** Serve tokeninfo with the given audience, plus the certs and userinfo. */
function serve(options: { audience?: string, tokenInfoStatus?: number, tokenInfoBody?: unknown } = {}): string[] {
  const seen: string[] = []
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input)
    seen.push(url)

    if (url.startsWith(TOKENINFO)) {
      if (options.tokenInfoBody !== undefined || options.tokenInfoStatus !== undefined) {
        return new Response(JSON.stringify(options.tokenInfoBody ?? {}), { status: options.tokenInfoStatus ?? 200 })
      }
      return Response.json({ aud: options.audience ?? CLIENT_ID, sub: 'google-sub-001', expires_in: 3599 })
    }

    if (url === CERTS)
      return Response.json({ keys: [{ kty: 'RSA', kid: KID, use: 'sig', alg: 'RS256', n: googleJwk.n, e: googleJwk.e }] })

    if (url.includes('/oauth2/v2/userinfo')) {
      return Response.json({
        id: 'google-sub-001',
        email: 'user@example.com',
        verified_email: true,
        name: 'A User',
        given_name: 'A',
        family_name: 'User',
        picture: 'https://example.com/a.png',
        locale: 'en',
      })
    }

    throw new Error(`unexpected fetch to ${url}`)
  }) as unknown as typeof fetch
  return seen
}

beforeEach(() => {
  clearSigningKeyCache()
})

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('GoogleProvider.getUserByToken', () => {
  test('refuses an access token minted for another client', async () => {
    serve({ audience: 'theirs.apps.googleusercontent.com' })
    await expect(provider().getUserByToken('ya29.attackers-token')).rejects.toThrow('issued to a different client')
  })

  test('checks the audience before it asks who the user is', async () => {
    const seen = serve({ audience: 'theirs.apps.googleusercontent.com' })
    await expect(provider().getUserByToken('ya29.attackers-token')).rejects.toThrow('issued to a different client')
    // userinfo is never reached, so a rejected token costs one request.
    expect(seen.some(url => url.includes('/userinfo'))).toBe(false)
  })

  test('accepts a token issued to us and maps the profile', async () => {
    serve()
    const user = await provider().getUserByToken('ya29.our-token')
    expect(user.id).toBe('google-sub-001')
    expect(user.email).toBe('user@example.com')
    expect(user.emailVerified).toBe(true)
    expect(user.nickname).toBe('A')
  })

  test('reads the audience under the older `audience` name too', async () => {
    serve({ tokenInfoBody: { audience: CLIENT_ID, sub: 'google-sub-001' } })
    expect((await provider().getUserByToken('ya29.our-token')).id).toBe('google-sub-001')
  })

  test('surfaces a tokeninfo rejection rather than falling through', async () => {
    serve({ tokenInfoStatus: 400, tokenInfoBody: { error: 'invalid_token' } })
    await expect(provider().getUserByToken('ya29.expired')).rejects.toThrow('not accepted by tokeninfo')
  })

  test('refuses a tokeninfo response that names no audience', async () => {
    serve({ tokenInfoBody: { sub: 'google-sub-001' } })
    await expect(provider().getUserByToken('ya29.odd')).rejects.toThrow('did not report an audience')
  })
})

describe('GoogleProvider.getUserByIdToken', () => {
  test('accepts an id_token Google signed for us', async () => {
    serve()
    const user = await provider().getUserByIdToken(googleIdToken(validClaims()))
    expect(user.id).toBe('google-sub-001')
    expect(user.email).toBe('user@example.com')
    expect(user.emailVerified).toBe(true)
    expect(user.avatar).toBe('https://example.com/a.png')
  })

  test('refuses an id_token Google did not sign', async () => {
    serve()
    const forged = googleIdToken(validClaims({ sub: 'victim', email: 'victim@example.com' }), 'NOT_A_REAL_SIGNATURE')
    await expect(provider().getUserByIdToken(forged)).rejects.toThrow('signature does not match')
  })

  test('refuses an id_token addressed to another client', async () => {
    serve()
    await expect(provider().getUserByIdToken(googleIdToken(validClaims({ aud: 'theirs.apps.googleusercontent.com' }))))
      .rejects.toThrow('addressed to a different client')
  })

  test('accepts either spelling of Google\'s issuer', async () => {
    serve()
    expect((await provider().getUserByIdToken(googleIdToken(validClaims({ iss: 'accounts.google.com' })))).id).toBe('google-sub-001')
    expect((await provider().getUserByIdToken(googleIdToken(validClaims({ iss: 'https://accounts.google.com' })))).id).toBe('google-sub-001')
  })

  test('checks a nonce when one is expected', async () => {
    serve()
    const token = googleIdToken(validClaims({ nonce: 'real' }))
    expect((await provider().getUserByIdToken(token, { nonce: 'real' })).id).toBe('google-sub-001')
    await expect(provider().getUserByIdToken(token, { nonce: 'other' })).rejects.toThrow('nonce does not match')
  })

  test('needs no tokeninfo round trip', async () => {
    const seen = serve()
    await provider().getUserByIdToken(googleIdToken(validClaims()))
    expect(seen.some(url => url.startsWith(TOKENINFO))).toBe(false)
  })
})
