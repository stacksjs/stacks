import { describe, expect, it } from 'bun:test'
import authConfig from '../../../../../config/auth'
import {
  resolveOAuthConsentWorkspace,
  resolveOAuthProviderConfig,
} from '../src/oauth-provider'

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
        authorizationRequest: 10 * 60 * 1000,
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
      lifetimes: { authorizationRequest: 0 },
    })).toThrow('authorizationRequest')
    expect(() => resolveOAuthProviderConfig({
      enabled: true,
      issuer: 'https://id.example.com',
      lifetimes: { authorizationCode: 0 },
    })).toThrow('authorizationCode')
    expect(() => resolveOAuthProviderConfig({
      enabled: true,
      issuer: 'https://id.example.com',
      lifetimes: { authorizationRequest: 1.5 },
    })).toThrow('authorizationRequest')
    expect(() => resolveOAuthProviderConfig({
      enabled: true,
      issuer: 'https://id.example.com',
      lifetimes: { accessToken: Number.MAX_SAFE_INTEGER + 1 },
    })).toThrow('accessToken')
    expect(() => resolveOAuthProviderConfig({
      enabled: true,
      issuer: 'https://id.example.com',
      lifetimes: { refreshToken: Number.MAX_SAFE_INTEGER },
    })).toThrow('supported date range')
    expect(() => resolveOAuthProviderConfig({
      enabled: true,
      issuer: 'https://id.example.com',
      consent: { rememberFor: 1.5 },
    })).toThrow('rememberFor')
    expect(() => resolveOAuthProviderConfig({
      enabled: true,
      issuer: 'https://id.example.com',
      endpoints: { token: 'https://tokens.example.net/oauth/token' },
    })).toThrow('issuer origin')
    expect(() => resolveOAuthProviderConfig({
      enabled: true,
      issuer: 'https://id.example.com',
      endpoints: { token: '/oauth/revoke' },
    })).toThrow('unique URL')
    expect(() => resolveOAuthProviderConfig({
      enabled: true,
      issuer: 'https://id.example.com/tenant/acme',
      endpoints: { authorization: '/.well-known/oauth-authorization-server/tenant/acme' },
    })).toThrow('metadata route')
  })

  it('allows plain HTTP only for loopback development issuers', () => {
    expect(resolveOAuthProviderConfig({ enabled: true, issuer: 'http://127.0.0.1:3000' })?.issuer)
      .toBe('http://127.0.0.1:3000')
    expect(resolveOAuthProviderConfig({ enabled: true, issuer: 'http://localhost:3000' })?.issuer)
      .toBe('http://localhost:3000')
  })

  it('rejects malformed or ambiguous scope and resource policy', () => {
    expect(() => resolveOAuthProviderConfig({
      enabled: true,
      issuer: 'https://id.example.com',
      scopes: { 'issues read': { description: 'Invalid scope token' } },
    })).toThrow('scope')
    expect(() => resolveOAuthProviderConfig({
      enabled: true,
      issuer: 'https://id.example.com',
      scopes: { 'issues:read': { description: 'Read issues', resources: ['missing'] } },
    })).toThrow('unknown resource')
    expect(() => resolveOAuthProviderConfig({
      enabled: true,
      issuer: 'https://id.example.com',
      resources: { bughq: { audience: '/relative-api' } },
    })).toThrow('absolute URI')
    expect(() => resolveOAuthProviderConfig({
      enabled: true,
      issuer: 'https://id.example.com',
      resources: {
        bughq: { audience: 'https://api.example.com' },
        loghq: { audience: 'https://api.example.com' },
      },
    })).toThrow('unique audience')
  })

  it('rejects duplicate client types and invalid consent policy', () => {
    expect(() => resolveOAuthProviderConfig({
      enabled: true,
      issuer: 'https://id.example.com',
      clientTypes: ['public', 'public'],
    })).toThrow('clientTypes')
    expect(() => resolveOAuthProviderConfig({
      enabled: true,
      issuer: 'https://id.example.com',
      consent: { rememberFor: -1 },
    })).toThrow('rememberFor')
    expect(() => resolveOAuthProviderConfig({
      enabled: true,
      issuer: 'https://id.example.com',
      consent: { view: '../outside' },
    })).toThrow('consent.view')
  })

  it('resolves and validates server-owned consent workspaces', async () => {
    const request = {} as never
    const user = { id: '42', email: 'ada@example.com' }
    const provider = resolveOAuthProviderConfig({
      enabled: true,
      issuer: 'https://id.example.com',
      consent: {
        resolveWorkspace: (context) => {
          expect(context).toEqual({ request, user })
          return { id: 'workspace-1', label: ' Acme Workspace ' }
        },
      },
    })!

    expect(await resolveOAuthConsentWorkspace(provider, { request, user })).toEqual({
      id: 'workspace-1',
      label: 'Acme Workspace',
    })

    const invalid = resolveOAuthProviderConfig({
      enabled: true,
      issuer: 'https://id.example.com',
      consent: { resolveWorkspace: () => ({ id: '', label: 'Missing id' }) },
    })!
    await expect(resolveOAuthConsentWorkspace(invalid, { request, user })).rejects.toThrow('workspace id')
  })

  it('snapshots policy so later config mutation cannot expand authorization', () => {
    const options = {
      enabled: true as const,
      issuer: 'https://id.example.com',
      scopes: { 'issues:read': { description: 'Read issues', resources: ['bughq'] } },
      resources: { bughq: { audience: 'https://api.bughq.example' } },
    }
    const resolved = resolveOAuthProviderConfig(options)!

    options.scopes['issues:read'].resources.push('loghq')
    options.resources.bughq.audience = 'https://evil.example'

    expect(resolved.scopes['issues:read']?.resources).toEqual(['bughq'])
    expect(resolved.resources.bughq?.audience).toBe('https://api.bughq.example')
  })
})
