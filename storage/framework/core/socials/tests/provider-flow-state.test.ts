import { afterEach, describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import { FacebookProvider, GitHubProvider, GoogleProvider, TwitterProvider } from '../src/drivers'
import { SOCIAL_PROVIDERS } from '../src/registry'

/**
 * The default callback runs on a fresh provider instance, so whatever the
 * redirect put in the authorization URL has to come from the caller: the
 * state (`withState`), extra parameters (`with`), the callback URL
 * (`setRedirectUrl`) and, for X, the PKCE verifier. Facebook and X minted a
 * private state and ignored the instance's redirect, and X kept its verifier
 * in a private field, so a callback could check none of it.
 */

const STATE = 'a'.repeat(64)
const settings = { clientId: 'client', clientSecret: 'secret', redirectUrl: 'https://app.test/auth/x/callback' }
const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('withState reaches every OAuth2 driver', () => {
  for (const Driver of [GoogleProvider, GitHubProvider, FacebookProvider, TwitterProvider]) {
    it(Driver.name, async () => {
      const url = new URL(await new Driver(settings).withState(STATE).getAuthUrl())
      expect(url.searchParams.get('state')).toBe(STATE)
    })
  }

  it('Facebook honours setRedirectUrl and with()', async () => {
    const url = new URL(await new FacebookProvider(settings)
      .setRedirectUrl('https://other.test/cb')
      .with({ auth_type: 'rerequest' })
      .withState(STATE)
      .getAuthUrl())
    expect(url.searchParams.get('redirect_uri')).toBe('https://other.test/cb')
    expect(url.searchParams.get('auth_type')).toBe('rerequest')
  })
})

describe('X keeps PKCE across the redirect', () => {
  it('declares PKCE in the registry so the default flow persists the verifier', () => {
    expect(SOCIAL_PROVIDERS.twitter.pkce).toBe(true)
    expect(SOCIAL_PROVIDERS.apple.nonce).toBe(true)
  })

  it('puts the challenge for the restorable verifier in the authorization URL', async () => {
    const start = new TwitterProvider(settings).withState(STATE)
    const url = new URL(await start.getAuthUrl())
    const verifier = start.getPkceVerifier()

    expect(verifier).toBeTruthy()
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('code_challenge')).toBe(createHash('sha256').update(verifier!).digest('base64url'))
  })

  it('exchanges the code on a fresh instance with the restored verifier', async () => {
    const start = new TwitterProvider(settings)
    await start.withState(STATE).getAuthUrl()
    const verifier = start.getPkceVerifier()!

    let body = ''
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      body = String(init?.body ?? '')
      return new Response(JSON.stringify({ access_token: 'at', token_type: 'bearer', expires_in: 1, scope: '' }), { headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch

    const token = await new TwitterProvider(settings).withCodeVerifier(verifier).getAccessToken('the-code')
    expect(token).toBe('at')
    expect(body).toContain(verifier)
  })

  it('refuses to exchange without a verifier rather than sending none', async () => {
    await expect(new TwitterProvider(settings).getAccessToken('the-code')).rejects.toThrow(/verifier/)
  })
})
