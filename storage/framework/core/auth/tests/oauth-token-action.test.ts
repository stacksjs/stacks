import type { RequestInstance } from '@stacksjs/types'
import { afterEach, describe, expect, it } from 'bun:test'
import { config } from '@stacksjs/config'
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
