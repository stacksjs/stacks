import { describe, expect, it } from 'bun:test'
import {
  OAuthClientRegistrationError,
  validateOAuthClientRegistration,
} from '../src/oauth-client-registration'
import { resolveOAuthProviderConfig } from '../src/oauth-provider'

const provider = resolveOAuthProviderConfig({
  enabled: true,
  issuer: 'https://id.example.com',
  scopes: {
    'issues:read': { description: 'Read issues', resources: ['bughq'] },
    'profile:read': { description: 'Read profile' },
  },
  resources: {
    bughq: { audience: 'https://api.bughq.example' },
    loghq: { audience: 'https://api.loghq.example' },
  },
})!

describe('OAuth client registration policy', () => {
  it('normalizes an explicit public authorization-code client', () => {
    expect(validateOAuthClientRegistration(provider, {
      name: '  BugHQ Reports  ',
      type: 'public',
      tokenEndpointAuthMethod: 'none',
      redirectUris: ['https://reports.example.com/oauth/callback'],
      grantTypes: ['authorization_code', 'refresh_token'],
      scopes: ['issues:read', 'profile:read'],
      resources: ['bughq'],
    })).toEqual({
      name: 'BugHQ Reports',
      type: 'public',
      tokenEndpointAuthMethod: 'none',
      redirectUris: ['https://reports.example.com/oauth/callback'],
      grantTypes: ['authorization_code', 'refresh_token'],
      scopes: ['issues:read', 'profile:read'],
      resources: ['bughq'],
      requiresSecret: false,
    })
  })

  it('requires confidential clients to authenticate without assigning public clients a secret', () => {
    expect(() => validateOAuthClientRegistration(provider, {
      name: 'Public app',
      type: 'public',
      tokenEndpointAuthMethod: 'client_secret_basic',
      redirectUris: ['https://public.example.com/callback'],
      grantTypes: ['authorization_code'],
      scopes: ['profile:read'],
      resources: [],
    })).toThrow(OAuthClientRegistrationError)

    expect(() => validateOAuthClientRegistration(provider, {
      name: 'Confidential app',
      type: 'confidential',
      tokenEndpointAuthMethod: 'none',
      redirectUris: ['https://server.example.com/callback'],
      grantTypes: ['authorization_code'],
      scopes: ['profile:read'],
      resources: [],
    })).toThrow('client_secret_basic')
  })

  it.each([
    'https://*.example.com/callback',
    'http://client.example.com/callback',
    'javascript:alert(1)',
    'https://client.example.com/callback#fragment',
    'https://user:pass@client.example.com/callback',
  ])('rejects unsafe redirect registration %s', (redirectUri) => {
    expect(() => validateOAuthClientRegistration(provider, {
      name: 'Unsafe app',
      type: 'public',
      tokenEndpointAuthMethod: 'none',
      redirectUris: [redirectUri],
      grantTypes: ['authorization_code'],
      scopes: ['profile:read'],
      resources: [],
    })).toThrow('redirect')
  })

  it('rejects redirect URIs that the token endpoint cannot accept', () => {
    const redirectUri = `https://client.example.com/${'a'.repeat(2022)}`
    expect(redirectUri.length).toBe(2049)

    expect(() => validateOAuthClientRegistration(provider, {
      name: 'Oversized callback app',
      type: 'public',
      tokenEndpointAuthMethod: 'none',
      redirectUris: [redirectUri],
      grantTypes: ['authorization_code'],
      scopes: ['profile:read'],
      resources: [],
    })).toThrow('redirect')
  })

  it('permits exact loopback HTTP registration without relaxing other hosts', () => {
    expect(validateOAuthClientRegistration(provider, {
      name: 'Native development app',
      type: 'public',
      tokenEndpointAuthMethod: 'none',
      redirectUris: ['http://localhost:4321/callback'],
      grantTypes: ['authorization_code'],
      scopes: ['profile:read'],
      resources: [],
    }).redirectUris).toEqual(['http://localhost:4321/callback'])
  })

  it('rejects unsupported grants and privileges outside provider policy', () => {
    const base = {
      name: 'Overbroad app',
      type: 'confidential' as const,
      tokenEndpointAuthMethod: 'client_secret_basic' as const,
      redirectUris: ['https://client.example.com/callback'],
      grantTypes: ['authorization_code'],
      scopes: ['profile:read'],
      resources: [] as string[],
    }

    expect(() => validateOAuthClientRegistration(provider, {
      ...base,
      grantTypes: ['implicit'],
    })).toThrow('grant')
    expect(() => validateOAuthClientRegistration(provider, {
      ...base,
      scopes: ['issues:write'],
    })).toThrow('scope')
    expect(() => validateOAuthClientRegistration(provider, {
      ...base,
      scopes: ['issues:read'],
    })).toThrow('resource')
    expect(() => validateOAuthClientRegistration(provider, {
      ...base,
      resources: ['unknown'],
    })).toThrow('resource')
  })

  it('rejects duplicate metadata instead of hiding registration mistakes', () => {
    expect(() => validateOAuthClientRegistration(provider, {
      name: 'Duplicate app',
      type: 'public',
      tokenEndpointAuthMethod: 'none',
      redirectUris: [
        'https://client.example.com/callback',
        'https://client.example.com/callback',
      ],
      grantTypes: ['authorization_code'],
      scopes: ['profile:read', 'profile:read'],
      resources: [],
    })).toThrow('duplicate')
  })
})
