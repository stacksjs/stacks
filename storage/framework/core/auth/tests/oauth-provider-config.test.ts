import { describe, expect, it } from 'bun:test'
import authConfig from '../../../../../config/auth'
import { resolveOAuthProviderConfig } from '../src/oauth-provider'

describe('OAuth authorization server configuration', () => {
  it('is unavailable unless the provider is explicitly enabled', () => {
    expect(resolveOAuthProviderConfig()).toBeNull()
    expect(resolveOAuthProviderConfig({ enabled: false, issuer: 'https://id.example.com' })).toBeNull()
    expect(resolveOAuthProviderConfig(authConfig.oauthProvider)).toBeNull()
  })

  it('resolves the fixed authorization-code profile from one canonical issuer', () => {
    const resolved = resolveOAuthProviderConfig({
      enabled: true,
      issuer: 'https://id.example.com/',
      scopes: {
        'issues:read': { description: 'Read issues', resources: ['bughq'] },
      },
      resources: {
        bughq: { audience: 'https://api.bughq.example' },
      },
    })

    expect(resolved).toEqual({
      enabled: true,
      issuer: 'https://id.example.com',
      endpoints: {
        authorization: 'https://id.example.com/oauth/authorize',
        token: 'https://id.example.com/oauth/token',
        revocation: 'https://id.example.com/oauth/revoke',
        introspection: 'https://id.example.com/oauth/introspect',
      },
      responseTypes: ['code'],
      grantTypes: ['authorization_code', 'refresh_token'],
      codeChallengeMethods: ['S256'],
      clientTypes: ['confidential', 'public'],
      scopes: {
        'issues:read': { description: 'Read issues', resources: ['bughq'] },
      },
      resources: {
        bughq: { audience: 'https://api.bughq.example' },
      },
      lifetimes: {
        authorizationCode: 10 * 60 * 1000,
        accessToken: 60 * 60 * 1000,
        refreshToken: 30 * 24 * 60 * 60 * 1000,
      },
      consent: {
        rememberFor: 0,
        view: 'auth/oauth/consent',
      },
    })
  })

  it('rejects an unsafe or incomplete enabled provider', () => {
    expect(() => resolveOAuthProviderConfig({ enabled: true })).toThrow('oauthProvider.issuer')
    expect(() => resolveOAuthProviderConfig({ enabled: true, issuer: 'http://id.example.com' })).toThrow('HTTPS')
    expect(() => resolveOAuthProviderConfig({
      enabled: true,
      issuer: 'https://id.example.com?tenant=other',
    })).toThrow('query or fragment')
    expect(() => resolveOAuthProviderConfig({
      enabled: true,
      issuer: 'https://id.example.com',
      lifetimes: { authorizationCode: 0 },
    })).toThrow('authorizationCode')
    expect(() => resolveOAuthProviderConfig({
      enabled: true,
      issuer: 'https://id.example.com',
      endpoints: { token: 'https://tokens.example.net/oauth/token' },
    })).toThrow('issuer origin')
  })

  it('allows plain HTTP only for loopback development issuers', () => {
    expect(resolveOAuthProviderConfig({ enabled: true, issuer: 'http://127.0.0.1:3000' })?.issuer)
      .toBe('http://127.0.0.1:3000')
    expect(resolveOAuthProviderConfig({ enabled: true, issuer: 'http://localhost:3000' })?.issuer)
      .toBe('http://localhost:3000')
  })
})
