import { describe, expect, it } from 'bun:test'
import {
  OAuthAuthorizationRequestError,
  validateOAuthAuthorizationRequest,
} from '../src/oauth-authorization'
import type {
  OAuthAuthorizationClientRegistration,
  OAuthAuthorizationRequestInput,
} from '../src/oauth-authorization'
import { resolveOAuthProviderConfig } from '../src/oauth-provider'

const provider = resolveOAuthProviderConfig({
  enabled: true,
  issuer: 'https://id.example.com',
  clientTypes: ['confidential', 'public'],
  scopes: {
    'issues:read': { description: 'Read issues', resources: ['bughq'] },
    'profile:read': { description: 'Read profile' },
  },
  resources: {
    bughq: { audience: 'https://api.bughq.example' },
    loghq: { audience: 'https://api.loghq.example' },
  },
})!

const client: OAuthAuthorizationClientRegistration = {
  id: 'client-123',
  type: 'public' as const,
  revoked: false,
  redirectUris: ['https://client.example.com/callback'],
  grantTypes: ['authorization_code'] as const,
  scopes: ['issues:read', 'profile:read'],
  resources: ['bughq'],
}

const validRequest: OAuthAuthorizationRequestInput = {
  responseType: 'code',
  clientId: 'client-123',
  redirectUri: 'https://client.example.com/callback',
  scope: 'issues:read profile:read',
  resource: ['https://api.bughq.example'],
  state: 'opaque-client-state',
  codeChallenge: 'a'.repeat(43),
  codeChallengeMethod: 'S256',
}

function captureError(
  overrides: Partial<OAuthAuthorizationRequestInput>,
  clientOverrides: Partial<Record<keyof OAuthAuthorizationClientRegistration, unknown>> = {},
) {
  try {
    validateOAuthAuthorizationRequest(provider, { ...client, ...clientOverrides } as OAuthAuthorizationClientRegistration, {
      ...validRequest,
      ...overrides,
    })
    throw new Error('Expected authorization request validation to fail.')
  }
  catch (error) {
    expect(error).toBeInstanceOf(OAuthAuthorizationRequestError)
    return error as OAuthAuthorizationRequestError
  }
}

describe('OAuth authorization request validation', () => {
  it('normalizes a request only after every registered boundary passes', () => {
    expect(validateOAuthAuthorizationRequest(provider, client, validRequest)).toEqual({
      responseType: 'code',
      clientId: 'client-123',
      clientType: 'public',
      redirectUri: 'https://client.example.com/callback',
      scopes: ['issues:read', 'profile:read'],
      resources: ['bughq'],
      audiences: ['https://api.bughq.example'],
      state: 'opaque-client-state',
      codeChallenge: 'a'.repeat(43),
      codeChallengeMethod: 'S256',
    })
  })

  it('never supplies a callback target before exact redirect validation', () => {
    for (const error of [
      captureError({ clientId: 'other-client' }),
      captureError({}, { revoked: true }),
      captureError({ redirectUri: 'https://client.example.com/callback/' }),
      captureError({ redirectUri: 'https://client.example.com/callback?next=/admin' }),
    ]) {
      expect(error.redirectUri).toBeNull()
      expect(error.state).toBeNull()
    }
  })

  it('requires the fixed authorization-code and S256 PKCE profile', () => {
    expect(captureError({ responseType: 'token' }).code).toBe('unsupported_response_type')
    expect(captureError({ codeChallengeMethod: 'plain' }).code).toBe('invalid_request')
    expect(captureError({ codeChallenge: 'too-short' }).code).toBe('invalid_request')
    expect(captureError({}, { grantTypes: [] }).code).toBe('unauthorized_client')
    expect(captureError({}, { type: 'public-unknown' }).code).toBe('unauthorized_client')
  })

  it('rejects unregistered or cross-resource permissions', () => {
    expect(captureError({ scope: 'issues:write' }).code).toBe('invalid_scope')
    expect(captureError({}, { scopes: ['profile:read'] }).code).toBe('invalid_scope')
    expect(captureError({ resource: ['https://api.loghq.example'] }).code).toBe('invalid_target')
    expect(captureError({ resource: [] }).code).toBe('invalid_target')
  })

  it('returns protocol errors only to a previously validated callback', () => {
    for (const error of [
      captureError({ responseType: 'token' }),
      captureError({ scope: 'issues:write' }),
      captureError({ resource: ['https://api.loghq.example'] }),
      captureError({ scope: 'issues:read  profile:read' }),
    ]) {
      expect(error.redirectUri).toBe(validRequest.redirectUri)
      expect(error.state).toBe(validRequest.state)
    }
  })

  it('allows only absolute HTTPS redirects, with exact loopback HTTP for development', () => {
    const loopback = {
      ...client,
      redirectUris: ['http://127.0.0.1:4321/callback'],
    }
    expect(validateOAuthAuthorizationRequest(provider, loopback, {
      ...validRequest,
      redirectUri: 'http://127.0.0.1:4321/callback',
    }).redirectUri).toBe('http://127.0.0.1:4321/callback')

    expect(captureError({ redirectUri: 'javascript:alert(1)' }, {
      redirectUris: ['javascript:alert(1)'],
    }).redirectUri).toBeNull()
    expect(captureError({ redirectUri: 'http://client.example.com/callback' }, {
      redirectUris: ['http://client.example.com/callback'],
    }).redirectUri).toBeNull()
  })
})
