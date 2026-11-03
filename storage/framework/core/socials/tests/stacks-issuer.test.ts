import { afterEach, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { StacksIssuerError, StacksIssuerProvider } from '../src/drivers/stacks-issuer'

const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })

const settings = {
  issuer: 'https://hq.example/api/platform/oauth',
  clientId: '12',
  clientSecret: 'shh secret',
  redirectUrl: 'https://client.example/api/auth/social/hq/callback',
  scopes: ['identity', 'profile'],
  resource: 'https://hq.example/api/platform',
  userInfoUrl: 'https://hq.example/api/platform/identity/me',
}

describe('StacksIssuerProvider', () => {
  test('authorizes with S256 PKCE, the resource and space-separated scopes', async () => {
    const provider = new StacksIssuerProvider(settings).withState('state-1')
    const url = new URL(await provider.getAuthUrl())
    expect(url.origin + url.pathname).toBe('https://hq.example/api/platform/oauth/authorize')
    expect(url.searchParams.get('scope')).toBe('identity profile')
    expect(url.searchParams.get('state')).toBe('state-1')
    expect(url.searchParams.getAll('resource')).toEqual(['https://hq.example/api/platform'])
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    const verifier = provider.getPkceVerifier()!
    expect(url.searchParams.get('code_challenge')).toBe(createHash('sha256').update(verifier).digest('base64url'))
  })

  test('exchanges the code with client_secret_basic and the restored verifier, keeping the refresh token', async () => {
    let seen: { url: string, auth: string | null, body: URLSearchParams } | null = null
    globalThis.fetch = (async (input: any, init?: RequestInit) => {
      seen = { url: String(input), auth: new Headers(init?.headers).get('authorization'), body: new URLSearchParams(String(init?.body)) }
      return Response.json({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope: 'identity profile', token_type: 'Bearer' })
    }) as typeof fetch
    const provider = new StacksIssuerProvider(settings).withCodeVerifier('v'.repeat(43))
    expect(await provider.getTokens('code-1')).toEqual({ accessToken: 'at', refreshToken: 'rt', expiresIn: 3600, scopes: ['identity', 'profile'] })
    expect(seen!.url).toBe('https://hq.example/api/platform/oauth/token')
    expect(seen!.auth).toBe(`Basic ${Buffer.from('12:shh%20secret').toString('base64')}`)
    expect(Object.fromEntries(seen!.body)).toMatchObject({ grant_type: 'authorization_code', code: 'code-1', code_verifier: 'v'.repeat(43), redirect_uri: settings.redirectUrl, resource: settings.resource })
  })

  test('refuses a code exchange with no verifier rather than sending one without PKCE', async () => {
    await expect(new StacksIssuerProvider(settings).getTokens('code')).rejects.toThrow('PKCE')
  })

  test('maps userinfo claims to a social user, trusting only a boolean email_verified', async () => {
    globalThis.fetch = (async (_: any, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer at')
      return Response.json({ sub: 'pairwise-1', name: 'Ada', email: 'ada@example.com', email_verified: true, picture: 'https://hq.example/a.png', units: 'metric' })
    }) as typeof fetch
    const user = await new StacksIssuerProvider(settings).getUserByToken('at')
    expect(user).toMatchObject({ id: 'pairwise-1', name: 'Ada', email: 'ada@example.com', emailVerified: true, avatar: 'https://hq.example/a.png' })
    expect(user.raw.units).toBe('metric')

    globalThis.fetch = (async () => Response.json({ sub: 'p', email: 'x@example.com', email_verified: 'true' })) as unknown as typeof fetch
    expect((await new StacksIssuerProvider(settings).getUserByToken('at')).emailVerified).toBeNull()
  })

  test('surfaces the issuer error code', async () => {
    globalThis.fetch = (async () => Response.json({ error: 'invalid_grant' }, { status: 400 })) as unknown as typeof fetch
    const failure = await new StacksIssuerProvider(settings).refreshTokens('old').catch(error => error)
    expect(failure).toBeInstanceOf(StacksIssuerError)
    expect(failure).toMatchObject({ code: 'invalid_grant', status: 400 })
  })

  test('revokes the refresh token at the revocation endpoint', async () => {
    let body = ''
    let url = ''
    globalThis.fetch = (async (input: any, init?: RequestInit) => { url = String(input); body = String(init?.body); return new Response('{}') }) as typeof fetch
    await new StacksIssuerProvider(settings).revokeToken('rt')
    expect(url).toBe('https://hq.example/api/platform/oauth/revoke')
    expect(Object.fromEntries(new URLSearchParams(body))).toEqual({ token: 'rt', token_type_hint: 'refresh_token' })
  })
})
