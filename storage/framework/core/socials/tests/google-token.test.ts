import { afterEach, describe, expect, test } from 'bun:test'
import { GoogleProvider } from '../src/drivers/google'

/**
 * stacksjs/stacks#2859: the code exchange went to
 * `accounts.google.com/oauth2/v4/token`, which still answers but has not been
 * the documented endpoint for years. Asserted on the request that leaves,
 * since an endpoint that silently keeps working produces no error to catch.
 */
const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

class InspectableGoogleProvider extends GoogleProvider {
  public tokenUrl_(): string {
    return this.getTokenUrl()
  }
}

describe('GoogleProvider token exchange', () => {
  test('posts the code to the documented token endpoint', async () => {
    const seen: string[] = []
    globalThis.fetch = (async (input: string | URL | Request) => {
      seen.push(String(input instanceof Request ? input.url : input))
      return Response.json({ access_token: 'ya29.token', token_type: 'Bearer', expires_in: 3599 })
    }) as typeof fetch

    const provider = new GoogleProvider({
      clientId: 'client.apps.googleusercontent.com',
      clientSecret: 'secret',
      redirectUrl: 'https://example.com/api/auth/sso/google/callback',
    })

    expect(await provider.getAccessToken('auth-code')).toBe('ya29.token')
    expect(seen).toEqual(['https://oauth2.googleapis.com/token'])
  })

  test('reports the same endpoint it exchanges against', () => {
    const provider = new InspectableGoogleProvider({ clientId: 'a', clientSecret: 'b', redirectUrl: 'https://example.com/cb' })
    expect(provider.tokenUrl_()).toBe('https://oauth2.googleapis.com/token')
  })
})
