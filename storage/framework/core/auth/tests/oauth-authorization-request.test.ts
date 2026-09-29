import { describe, expect, it } from 'bun:test'
import {
  OAuthAuthorizationRequestError,
  parseOAuthAuthorizationRequest,
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

function captureParseError(query: string): OAuthAuthorizationRequestError {
  try {
    parseOAuthAuthorizationRequest(query)
    throw new Error('Expected authorization request parsing to fail.')
  }
  catch (error) {
    expect(error).toBeInstanceOf(OAuthAuthorizationRequestError)
    return error as OAuthAuthorizationRequestError
  }
}

describe('OAuth authorization request parsing', () => {
  it('preserves repeatable resource indicators and ignores extension parameters', () => {
    expect(parseOAuthAuthorizationRequest(new URLSearchParams([
      ['response_type', 'code'],
      ['client_id', 'client-123'],
      ['redirect_uri', 'https://client.example.com/callback'],
      ['scope', 'issues:read profile:read'],
      ['resource', 'https://api.bughq.example'],
      ['resource', 'https://api.loghq.example'],
      ['state', 'opaque-client-state'],
      ['code_challenge', 'a'.repeat(43)],
      ['code_challenge_method', 'S256'],
      ['extension', 'ignored'],
    ]))).toEqual({
      responseType: 'code',
      clientId: 'client-123',
      redirectUri: 'https://client.example.com/callback',
      scope: 'issues:read profile:read',
      resource: ['https://api.bughq.example', 'https://api.loghq.example'],
      state: 'opaque-client-state',
      codeChallenge: 'a'.repeat(43),
      codeChallengeMethod: 'S256',
    })
  })

  it('rejects repeated scalar parameters before exposing a callback target', () => {
    for (const name of [
      'response_type',
      'client_id',
      'redirect_uri',
      'scope',
      'state',
      'code_challenge',
      'code_challenge_method',
    ]) {
      const query = new URLSearchParams({
        response_type: 'code',
        client_id: 'client-123',
        redirect_uri: 'https://client.example.com/callback',
        code_challenge: 'a'.repeat(43),
        code_challenge_method: 'S256',
      })
      if (name === 'scope' || name === 'state')
        query.append(name, 'first')
      query.append(name, 'duplicate')
      const error = captureParseError(query.toString())
      expect(error.code).toBe('invalid_request')
      expect(error.redirectUri).toBeNull()
      expect(error.state).toBeNull()
    }
  })

  it('rejects missing required values and oversized browser requests', () => {
    expect(captureParseError('response_type=code').code).toBe('invalid_request')
    expect(captureParseError(`state=${'s'.repeat(8193)}`).code).toBe('invalid_request')
  })
})

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
    expect(captureError({ scope: undefined }).code).toBe('invalid_scope')
    expect(captureError({ scope: '' }).code).toBe('invalid_scope')
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

  it('does not reflect oversized state into a callback or persist it for consent', () => {
    const error = captureError({ state: 's'.repeat(4097) })

    expect(error.code).toBe('invalid_request')
    expect(error.redirectUri).toBe(validRequest.redirectUri)
    expect(error.state).toBeNull()
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
