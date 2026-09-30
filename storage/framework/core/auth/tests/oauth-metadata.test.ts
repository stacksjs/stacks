import { describe, expect, it } from 'bun:test'
import {
  oauthAuthorizationServerMetadata,
  oauthAuthorizationServerMetadataPath,
} from '../src/oauth-metadata'
import { resolveOAuthProviderConfig } from '../src/oauth-provider'

describe('OAuth authorization-server metadata', () => {
  it('derives the RFC 8414 discovery path from the complete issuer', () => {
    expect(oauthAuthorizationServerMetadataPath('https://id.example.com')).toBe('/.well-known/oauth-authorization-server')
    expect(oauthAuthorizationServerMetadataPath('https://id.example.com/tenant/acme'))
      .toBe('/.well-known/oauth-authorization-server/tenant/acme')
  })

  it('advertises only the provider capabilities that are implemented', () => {
    const provider = resolveOAuthProviderConfig({
      enabled: true,
      issuer: 'https://id.example.com',
      scopes: {
        'profile:read': { description: 'Read profile' },
        'issues:read': { description: 'Read issues', resources: ['bughq'] },
      },
      resources: {
        bughq: { audience: 'https://api.bughq.example' },
      },
    })!

    const metadata = oauthAuthorizationServerMetadata(provider)

    expect(metadata).toEqual({
      issuer: 'https://id.example.com',
      authorization_endpoint: 'https://id.example.com/oauth/authorize',
      token_endpoint: 'https://id.example.com/oauth/token',
      revocation_endpoint: 'https://id.example.com/oauth/revoke',
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'none'],
      revocation_endpoint_auth_methods_supported: ['client_secret_basic', 'none'],
      scopes_supported: ['issues:read', 'profile:read'],
    })
    expect('introspection_endpoint' in metadata).toBe(false)
  })

  it('does not advertise a client authentication method the provider disabled', () => {
    const publicOnly = resolveOAuthProviderConfig({
      enabled: true,
      issuer: 'https://id.example.com',
      clientTypes: ['public'],
    })!

    const metadata = oauthAuthorizationServerMetadata(publicOnly)

    expect(metadata.token_endpoint_auth_methods_supported).toEqual(['none'])
    expect(metadata.revocation_endpoint_auth_methods_supported).toEqual(['none'])
  })

  it('advertises client credentials only when the provider enables it', () => {
    const provider = resolveOAuthProviderConfig({
      enabled: true,
      issuer: 'https://id.example.com',
      clientCredentials: true,
    })!

    expect(oauthAuthorizationServerMetadata(provider).grant_types_supported)
      .toEqual(['authorization_code', 'refresh_token', 'client_credentials'])
  })
})
