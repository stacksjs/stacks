import type { RequestInstance } from '@stacksjs/types'
import { afterEach, describe, expect, it } from 'bun:test'
import { config } from '@stacksjs/config'
import OAuthMetadataAction from '../../../defaults/app/Actions/Auth/OAuthMetadataAction'
import OAuthRevocationAction from '../../../defaults/app/Actions/Auth/OAuthRevocationAction'
import OAuthTokenAction from '../../../defaults/app/Actions/Auth/OAuthTokenAction'

const originalProvider = config.auth.oauthProvider

function request(contentType: string, body: string): RequestInstance {
  return {
    method: 'POST',
    url: 'https://id.example.com/oauth/token',
    headers: new Headers({ 'content-type': contentType }),
    rawBody: async () => body,
  } as RequestInstance
}

afterEach(() => {
  config.auth.oauthProvider = originalProvider
})

describe('OAuth token route action', () => {
  it('stays unavailable until the provider is explicitly enabled', async () => {
    config.auth.oauthProvider = { ...originalProvider, enabled: false }

    const result = await OAuthTokenAction.handle(request(
      'application/x-www-form-urlencoded',
      'grant_type=authorization_code',
    ))

    expect(result.status).toBe(404)
  })

  it('forwards enabled requests to the no-store protocol boundary without CSRF', async () => {
    config.auth.oauthProvider = {
      ...originalProvider,
      enabled: true,
      issuer: 'https://id.example.com',
    }

    const result = await OAuthTokenAction.handle(request(
      'application/json',
      '{"grant_type":"authorization_code"}',
    ))

    expect(OAuthTokenAction.skipCsrf).toBe(true)
    expect(result.status).toBe(400)
    expect(result.headers.get('cache-control')).toBe('no-store')
    expect(await result.json()).toEqual({ error: 'invalid_request' })
  })
})

describe('OAuth revocation route action', () => {
  it('stays unavailable until the provider is explicitly enabled', async () => {
    config.auth.oauthProvider = { ...originalProvider, enabled: false }

    const result = await OAuthRevocationAction.handle(request(
      'application/x-www-form-urlencoded',
      'token=unknown&client_id=17',
    ))

    expect(result.status).toBe(404)
  })

  it('forwards enabled requests to the no-store protocol boundary without CSRF', async () => {
    config.auth.oauthProvider = {
      ...originalProvider,
      enabled: true,
      issuer: 'https://id.example.com',
    }

    const result = await OAuthRevocationAction.handle(request(
      'application/json',
      '{"token":"unknown"}',
    ))

    expect(OAuthRevocationAction.skipCsrf).toBe(true)
    expect(result.status).toBe(400)
    expect(result.headers.get('cache-control')).toBe('no-store')
    expect(await result.json()).toEqual({ error: 'invalid_request' })
  })
})

describe('OAuth metadata route action', () => {
  it('stays unavailable until the provider is explicitly enabled', async () => {
    config.auth.oauthProvider = { ...originalProvider, enabled: false }

    const result = await OAuthMetadataAction.handle({} as RequestInstance)

    expect(result.status).toBe(404)
  })

  it('publishes only the capabilities the enabled provider implements', async () => {
    config.auth.oauthProvider = {
      ...originalProvider,
      enabled: true,
      issuer: 'https://id.example.com',
      scopes: { 'issues:read': { description: 'Read issues' } },
    }

    const result = await OAuthMetadataAction.handle({} as RequestInstance)
    const metadata = await result.json() as Record<string, unknown>

    expect(result.status).toBe(200)
    expect(result.headers.get('cache-control')).toBe('public, max-age=300')
    expect(metadata.issuer).toBe('https://id.example.com')
    expect(metadata.token_endpoint).toBe('https://id.example.com/oauth/token')
    expect(metadata.revocation_endpoint).toBe('https://id.example.com/oauth/revoke')
    expect(metadata.scopes_supported).toEqual(['issues:read'])
    expect(metadata).not.toHaveProperty('introspection_endpoint')
  })
})
