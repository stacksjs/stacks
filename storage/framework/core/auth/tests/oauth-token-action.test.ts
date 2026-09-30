import type { RequestInstance } from '@stacksjs/types'
import { afterEach, describe, expect, it } from 'bun:test'
import { config } from '@stacksjs/config'
import OAuthAuthorizationAction from '../../../defaults/app/Actions/Auth/OAuthAuthorizationAction'
import OAuthClientDisableAction from '../../../defaults/app/Actions/Auth/OAuthClientDisableAction'
import OAuthClientStoreAction from '../../../defaults/app/Actions/Auth/OAuthClientStoreAction'
import OAuthClientSecretRotateAction from '../../../defaults/app/Actions/Auth/OAuthClientSecretRotateAction'
import OAuthClientUpdateAction from '../../../defaults/app/Actions/Auth/OAuthClientUpdateAction'
import OAuthClientsAction from '../../../defaults/app/Actions/Auth/OAuthClientsAction'
import OAuthConnectionsAction from '../../../defaults/app/Actions/Auth/OAuthConnectionsAction'
import OAuthConsentAction from '../../../defaults/app/Actions/Auth/OAuthConsentAction'
import OAuthDisconnectAction from '../../../defaults/app/Actions/Auth/OAuthDisconnectAction'
import OAuthMetadataAction from '../../../defaults/app/Actions/Auth/OAuthMetadataAction'
import OAuthIntrospectionAction from '../../../defaults/app/Actions/Auth/OAuthIntrospectionAction'
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

function browserRequest(
  url: string,
  init: RequestInit = {},
  user?: { id: number | string, email: string, name?: string },
): RequestInstance {
  const value = new Request(url, init) as Request & {
    user: () => Promise<typeof user>
    _csrfToken?: string
  }
  value.user = async () => user
  value._csrfToken = 'csrf-proof'
  return value as unknown as RequestInstance
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

describe('OAuth introspection route action', () => {
  it('stays unavailable until introspection is explicitly enabled', async () => {
    config.auth.oauthProvider = { ...originalProvider, enabled: false }
    const disabled = await OAuthIntrospectionAction.handle(request(
      'application/x-www-form-urlencoded',
      'token=unknown',
    ))

    config.auth.oauthProvider = {
      ...originalProvider,
      enabled: true,
      introspection: false,
      issuer: 'https://id.example.com',
    }
    const optedOut = await OAuthIntrospectionAction.handle(request(
      'application/x-www-form-urlencoded',
      'token=unknown',
    ))

    expect(disabled.status).toBe(404)
    expect(optedOut.status).toBe(404)
  })

  it('forwards enabled requests to the protected protocol boundary without CSRF', async () => {
    config.auth.oauthProvider = {
      ...originalProvider,
      enabled: true,
      introspection: true,
      issuer: 'https://id.example.com',
    }

    const result = await OAuthIntrospectionAction.handle(request(
      'application/json',
      '{"token":"unknown"}',
    ))

    expect(OAuthIntrospectionAction.skipCsrf).toBe(true)
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

describe('OAuth browser authorization route actions', () => {
  it('keeps the browser flow unavailable while the provider is disabled', async () => {
    config.auth.oauthProvider = { ...originalProvider, enabled: false }

    const getResult = await OAuthAuthorizationAction.handle(browserRequest('https://id.example.com/oauth/authorize'))
    const postResult = await OAuthConsentAction.handle(browserRequest('https://id.example.com/oauth/authorize', { method: 'POST' }))

    expect(getResult.status).toBe(404)
    expect(postResult.status).toBe(404)
  })

  it('delegates malformed browser requests to the protocol boundary without exposing redirects', async () => {
    config.auth.oauthProvider = {
      ...originalProvider,
      enabled: true,
      issuer: 'https://id.example.com',
    }

    const result = await OAuthAuthorizationAction.handle(browserRequest('https://id.example.com/oauth/authorize'))

    expect(result.status).toBe(400)
    expect(result.headers.get('location')).toBeNull()
    expect(result.headers.get('cache-control')).toBe('no-store')
  })

  it('requires an authenticated subject for consent and preserves normal CSRF handling', async () => {
    config.auth.oauthProvider = {
      ...originalProvider,
      enabled: true,
      issuer: 'https://id.example.com',
    }

    const anonymous = await OAuthConsentAction.handle(browserRequest(
      'https://id.example.com/oauth/authorize',
      { method: 'POST' },
    ))
    const authenticated = await OAuthConsentAction.handle(browserRequest(
      'https://id.example.com/oauth/authorize',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
      { id: '42', email: 'ada@example.com' },
    ))

    expect(OAuthConsentAction.skipCsrf).not.toBe(true)
    expect(anonymous.status).toBe(401)
    expect(authenticated.status).toBe(415)
    expect(authenticated.headers.get('location')).toBeNull()
  })
})

describe('OAuth connected application route actions', () => {
  it('keeps connected applications unavailable while the provider is disabled', async () => {
    config.auth.oauthProvider = { ...originalProvider, enabled: false }

    const listResult = await OAuthConnectionsAction.handle(browserRequest('https://id.example.com/auth/oauth/connections'))
    const disconnectResult = await OAuthDisconnectAction.handle(browserRequest(
      'https://id.example.com/auth/oauth/connections/0123456789abcdef0123456789abcdef/disconnect',
      { method: 'POST' },
    ))

    expect(listResult.status).toBe(404)
    expect(disconnectResult.status).toBe(404)
  })

  it('requires an authenticated subject for listing and disconnecting applications', async () => {
    config.auth.oauthProvider = {
      ...originalProvider,
      enabled: true,
      issuer: 'https://id.example.com',
    }

    const listResult = await OAuthConnectionsAction.handle(browserRequest('https://id.example.com/auth/oauth/connections'))
    const disconnectResult = await OAuthDisconnectAction.handle(browserRequest(
      'https://id.example.com/auth/oauth/connections/0123456789abcdef0123456789abcdef/disconnect',
      { method: 'POST' },
    ))

    expect(listResult.status).toBe(401)
    expect(disconnectResult.status).toBe(401)
  })

  it('rejects malformed grant identifiers before touching the store', async () => {
    config.auth.oauthProvider = {
      ...originalProvider,
      enabled: true,
      issuer: 'https://id.example.com',
    }
    const value = browserRequest(
      'https://id.example.com/auth/oauth/connections/not-a-grant/disconnect',
      { method: 'POST' },
      { id: '42', email: 'ada@example.com' },
    ) as RequestInstance & { getParam: (name: string) => string }
    value.getParam = () => 'not-a-grant'

    const result = await OAuthDisconnectAction.handle(value)

    expect(OAuthDisconnectAction.skipCsrf).not.toBe(true)
    expect(result.status).toBe(400)
  })
})

describe('OAuth client management route actions', () => {
  it('keeps client management unavailable while the provider is disabled', async () => {
    config.auth.oauthProvider = { ...originalProvider, enabled: false }

    const result = await OAuthClientsAction.handle(browserRequest('https://id.example.com/auth/oauth/clients'))

    expect(result.status).toBe(404)
  })

  it('requires an authenticated owner to list clients', async () => {
    config.auth.oauthProvider = {
      ...originalProvider,
      enabled: true,
      issuer: 'https://id.example.com',
    }

    const result = await OAuthClientsAction.handle(browserRequest('https://id.example.com/auth/oauth/clients'))

    expect(result.status).toBe(401)
  })

  it('keeps client registration unavailable while the provider is disabled', async () => {
    config.auth.oauthProvider = { ...originalProvider, enabled: false }

    const result = await OAuthClientStoreAction.handle(browserRequest(
      'https://id.example.com/auth/oauth/clients',
      { method: 'POST' },
    ))

    expect(result.status).toBe(404)
  })

  it('requires an authenticated owner and explicit registration metadata', async () => {
    config.auth.oauthProvider = {
      ...originalProvider,
      enabled: true,
      issuer: 'https://id.example.com',
    }

    const anonymous = await OAuthClientStoreAction.handle(browserRequest(
      'https://id.example.com/auth/oauth/clients',
      { method: 'POST' },
    ))
    const malformed = browserRequest(
      'https://id.example.com/auth/oauth/clients',
      { method: 'POST' },
      { id: '42', email: 'ada@example.com' },
    ) as RequestInstance & { all: () => Record<string, unknown> }
    malformed.all = () => ({
      name: 'Browser client',
      type: 'public',
      redirect_uris: 'https://client.example/callback',
      scopes: ['issues:read'],
      resources: [],
    })

    const malformedResult = await OAuthClientStoreAction.handle(malformed)

    expect(OAuthClientStoreAction.skipCsrf).not.toBe(true)
    expect(anonymous.status).toBe(401)
    expect(malformedResult.status).toBe(400)
  })

  it('keeps client editing unavailable while the provider is disabled', async () => {
    config.auth.oauthProvider = { ...originalProvider, enabled: false }

    const result = await OAuthClientUpdateAction.handle(browserRequest(
      'https://id.example.com/auth/oauth/clients/17',
      { method: 'PATCH' },
    ))

    expect(result.status).toBe(404)
  })

  it('requires an authenticated owner and explicit edit metadata', async () => {
    config.auth.oauthProvider = {
      ...originalProvider,
      enabled: true,
      issuer: 'https://id.example.com',
    }

    const anonymous = await OAuthClientUpdateAction.handle(browserRequest(
      'https://id.example.com/auth/oauth/clients/17',
      { method: 'PATCH' },
    ))
    const malformed = browserRequest(
      'https://id.example.com/auth/oauth/clients/not-a-client',
      { method: 'PATCH' },
      { id: '42', email: 'ada@example.com' },
    ) as RequestInstance & {
      all: () => Record<string, unknown>
      getParam: (name: string) => string
    }
    malformed.getParam = () => 'not-a-client'
    malformed.all = () => ({
      name: 'Updated client',
      redirect_uris: ['https://client.example/callback'],
      scopes: ['issues:read'],
      resources: [],
    })

    const malformedResult = await OAuthClientUpdateAction.handle(malformed)

    expect(OAuthClientUpdateAction.skipCsrf).not.toBe(true)
    expect(anonymous.status).toBe(401)
    expect(malformedResult.status).toBe(400)
  })

  it('keeps secret rotation unavailable while the provider is disabled', async () => {
    config.auth.oauthProvider = { ...originalProvider, enabled: false }

    const result = await OAuthClientSecretRotateAction.handle(browserRequest(
      'https://id.example.com/auth/oauth/clients/17/rotate-secret',
      { method: 'POST' },
    ))

    expect(result.status).toBe(404)
  })

  it('requires an authenticated owner and a valid client id to rotate a secret', async () => {
    config.auth.oauthProvider = {
      ...originalProvider,
      enabled: true,
      issuer: 'https://id.example.com',
    }

    const anonymous = await OAuthClientSecretRotateAction.handle(browserRequest(
      'https://id.example.com/auth/oauth/clients/17/rotate-secret',
      { method: 'POST' },
    ))
    const malformed = browserRequest(
      'https://id.example.com/auth/oauth/clients/not-a-client/rotate-secret',
      { method: 'POST' },
      { id: '42', email: 'ada@example.com' },
    ) as RequestInstance & { getParam: (name: string) => string }
    malformed.getParam = () => 'not-a-client'

    const malformedResult = await OAuthClientSecretRotateAction.handle(malformed)

    expect(OAuthClientSecretRotateAction.skipCsrf).not.toBe(true)
    expect(anonymous.status).toBe(401)
    expect(malformedResult.status).toBe(400)
  })

  it('keeps client disable unavailable while the provider is disabled', async () => {
    config.auth.oauthProvider = { ...originalProvider, enabled: false }

    const result = await OAuthClientDisableAction.handle(browserRequest(
      'https://id.example.com/auth/oauth/clients/17/disable',
      { method: 'POST' },
    ))

    expect(result.status).toBe(404)
  })

  it('requires an authenticated owner and a valid client id to disable a client', async () => {
    config.auth.oauthProvider = {
      ...originalProvider,
      enabled: true,
      issuer: 'https://id.example.com',
    }

    const anonymous = await OAuthClientDisableAction.handle(browserRequest(
      'https://id.example.com/auth/oauth/clients/17/disable',
      { method: 'POST' },
    ))
    const malformed = browserRequest(
      'https://id.example.com/auth/oauth/clients/not-a-client/disable',
      { method: 'POST' },
      { id: '42', email: 'ada@example.com' },
    ) as RequestInstance & { getParam: (name: string) => string }
    malformed.getParam = () => 'not-a-client'

    const malformedResult = await OAuthClientDisableAction.handle(malformed)

    expect(OAuthClientDisableAction.skipCsrf).not.toBe(true)
    expect(anonymous.status).toBe(401)
    expect(malformedResult.status).toBe(400)
  })
})
