import { describe, expect, it } from 'bun:test'
import { OAuthAuthorizationRequestError } from '../src/oauth-authorization'
import {
  oauthAuthorizationConsentResponse,
  oauthAuthorizationRequestErrorResponse,
} from '../src/oauth-authorization-response'

describe('OAuth authorization responses', () => {
  it('redirects an approved code without preserving stale protocol parameters', () => {
    const response = oauthAuthorizationConsentResponse({
      code: 'fresh-code',
      grantId: '0123456789abcdef0123456789abcdef',
      redirectUri: 'https://client.example/callback?tenant=acme&code=stale&error=stale&state=stale&error_description=stale',
      state: 'state with spaces&symbols',
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://client.example/callback?tenant=acme&code=fresh-code&state=state+with+spaces%26symbols')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('pragma')).toBe('no-cache')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
  })

  it('redirects a denial without inventing absent state', () => {
    const response = oauthAuthorizationConsentResponse({
      error: 'access_denied',
      redirectUri: 'https://client.example/callback?tenant=acme',
      state: null,
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://client.example/callback?tenant=acme&error=access_denied')
  })

  it('redirects protocol errors only when validation supplied a safe callback', () => {
    const response = oauthAuthorizationRequestErrorResponse(new OAuthAuthorizationRequestError(
      'invalid_scope',
      'internal details must stay local',
      'https://client.example/callback',
      'opaque-state',
    ))
    expect(response?.headers.get('location')).toBe('https://client.example/callback?error=invalid_scope&state=opaque-state')

    expect(oauthAuthorizationRequestErrorResponse(new OAuthAuthorizationRequestError(
      'invalid_request',
      'no validated callback',
    ))).toBeNull()
    expect(() => oauthAuthorizationRequestErrorResponse(new OAuthAuthorizationRequestError(
      'invalid_request',
      'unsafe callback',
      'javascript:alert(1)',
    ))).toThrow('safe redirect URI')
  })
})
