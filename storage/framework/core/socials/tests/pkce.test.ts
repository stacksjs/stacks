import { Buffer } from 'node:buffer'
import { afterEach, describe, expect, test } from 'bun:test'
import { GitHubProvider } from '../src/drivers/github'
import { GoogleProvider } from '../src/drivers/google'
import { TwitterProvider } from '../src/drivers/twitter'

/**
 * stacksjs/stacks#2908 — `enablePKCE()` used to produce
 * `code_challenge=[object Promise]` from `getCodeFields()`, and nothing
 * called `getCodeFields()` anyway, so on a real driver it produced nothing
 * at all. The verifier was regenerated on every call and stored nowhere, so
 * even with the await added there was no value the exchange could send.
 *
 * The single assertion the issue asked for is the first one here: a
 * `code_challenge` of 43 base64url characters catches both halves.
 */

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

function github(): any {
  return new GitHubProvider({ clientId: 'cid', clientSecret: 'sec', redirectUrl: 'https://app.example/cb' })
}

async function s256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return Buffer.from(new Uint8Array(digest)).toString('base64url')
}

describe('PKCE on the authorization request', () => {
  test('the challenge is 43 base64url characters, not a stringified promise', async () => {
    const url = new URL(await github().enablePKCE().getAuthUrl())
    const challenge = url.searchParams.get('code_challenge')

    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(challenge).not.toBe('[object Promise]')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  })

  test('the challenge is the S256 digest of the verifier that is kept', async () => {
    const provider = github().enablePKCE()
    const url = new URL(await provider.getAuthUrl())

    const verifier = provider.getPkceVerifier()
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/)
    expect(await s256(verifier!)).toBe(url.searchParams.get('code_challenge'))
  })

  test('the verifier is generated once, not fresh on every read', async () => {
    const provider = github().enablePKCE()
    await provider.getAuthUrl()

    const first = provider.getPkceVerifier()
    expect(provider.getPkceVerifier()).toBe(first)
    // A second URL from the same instance belongs to the same authorization.
    const again = new URL(await provider.getAuthUrl())
    expect(again.searchParams.get('code_challenge')).toBe(await s256(first!))
  })

  test('two authorizations get two different verifiers', async () => {
    const one = github().enablePKCE()
    const two = github().enablePKCE()
    await one.getAuthUrl()
    await two.getAuthUrl()
    expect(one.getPkceVerifier()).not.toBe(two.getPkceVerifier())
  })

  test('PKCE stays off unless it is asked for', async () => {
    const url = new URL(await github().getAuthUrl())
    expect(url.searchParams.has('code_challenge')).toBe(false)
    expect(url.searchParams.has('code_challenge_method')).toBe(false)
    expect(github().getPkceVerifier()).toBeNull()
  })

  test('Google carries it too', async () => {
    // Facebook is wired the same way but cannot be driven from here:
    // FacebookProvider.getConfig() reads only the global config and ignores
    // its constructor arguments, unlike every other driver. That is its own
    // bug, not this one.
    const google = new GoogleProvider({ clientId: 'c', clientSecret: 's', redirectUrl: 'https://app.example/cb' }) as any
    const url = new URL(await google.enablePKCE().getAuthUrl())
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  })
})

describe('PKCE across the round trip', () => {
  test('the verifier survives into a new instance and reaches the token request', async () => {
    const starting = github().enablePKCE()
    await starting.getAuthUrl()
    const stashed = starting.getPkceVerifier()!

    // The callback is a different request, so a different instance.
    const exchanging = github().withCodeVerifier(stashed)

    const sent: Record<string, unknown>[] = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      sent.push(await new Request(input, init).json())
      return Response.json({ access_token: 'gho_token' })
    }) as unknown as typeof fetch

    expect(await exchanging.getAccessToken('the-code')).toBe('gho_token')
    expect(sent).toHaveLength(1)
    expect(sent[0]?.code_verifier).toBe(stashed)
  })

  test('an exchange without PKCE sends no code_verifier', async () => {
    const sent: Record<string, unknown>[] = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      sent.push(await new Request(input, init).json())
      return Response.json({ access_token: 'gho_token' })
    }) as unknown as typeof fetch

    await github().getAccessToken('the-code')
    expect(sent).toHaveLength(1)
    expect(sent[0]).not.toHaveProperty('code_verifier')
  })

  test('JSON and form token exchanges carry the restored verifier over HTTP', async () => {
    const received: Array<{ path: string, method: string, type: string, fields: Record<string, unknown> }> = []
    const server = Bun.serve({ port: 0, hostname: '127.0.0.1', async fetch(request) {
      const type = request.headers.get('Content-Type') || ''
      const fields = type.includes('application/json')
        ? await request.json()
        : Object.fromEntries(new URLSearchParams(await request.text()))
      received.push({ path: new URL(request.url).pathname, method: request.method, type, fields })
      return Response.json({ access_token: 'wire-token', token_type: 'bearer', expires_in: 60, scope: '' })
    } })
    // Redirect only the external provider transport. The client constructs
    // real requests, and the server decodes the bytes actually sent over HTTP.
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init)
      const original = new URL(request.url)
      const destination = new URL(original.pathname + original.search, server.url)
      return realFetch(new Request(destination, request))
    }) as typeof fetch
    try {
      const start = github().enablePKCE()
      await start.getAuthUrl()
      const verifier = start.getPkceVerifier()!
      expect(await github().withCodeVerifier(verifier).getAccessToken('github-code')).toBe('wire-token')
      expect(await github().getAccessToken('without-pkce')).toBe('wire-token')
      const settings = { clientId: 'client', clientSecret: 'secret', redirectUrl: 'https://app.test/callback' }
      const twitter = new TwitterProvider(settings)
      await twitter.getAuthUrl()
      const twitterVerifier = twitter.getPkceVerifier()!
      expect(await new TwitterProvider(settings).withCodeVerifier(twitterVerifier).getAccessToken('twitter-code')).toBe('wire-token')
      expect(received).toHaveLength(3)
      expect(received.map(request => request.method)).toEqual(['POST', 'POST', 'POST'])
      expect(received.map(request => request.path)).toEqual(['/login/oauth/access_token', '/login/oauth/access_token', '/2/oauth2/token'])
      expect(received[0]?.type).toContain('application/json')
      expect(received[0]?.fields.code_verifier).toBe(verifier)
      expect(received[1]?.fields).not.toHaveProperty('code_verifier')
      expect(received[2]?.type).toContain('application/x-www-form-urlencoded')
      expect(received[2]?.fields.code_verifier).toBe(twitterVerifier)
    }
    finally { await server.stop(true) }
  })

  test('PKCE enabled with no verifier refuses the exchange rather than dropping it', async () => {
    // Quietly omitting code_verifier either fails at a provider that
    // enforces PKCE, or succeeds at one that does not and leaves the caller
    // believing the code was protected. The second is the bug being fixed.
    const provider = github().enablePKCE()
    expect(() => provider.pkceTokenFields()).toThrow('no code verifier is known')
  })

  test('withCodeVerifier refuses an empty verifier', () => {
    expect(() => github().withCodeVerifier('')).toThrow('non-empty')
  })
})
