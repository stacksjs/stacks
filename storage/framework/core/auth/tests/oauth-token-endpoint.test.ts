import { describe, expect, it } from 'bun:test'
import { resolveOAuthProviderConfig } from '../src/oauth-provider'
import { handleOAuthTokenRequest } from '../src/oauth-token-endpoint'

const provider = resolveOAuthProviderConfig({
  enabled: true,
  issuer: 'https://id.example.com',
  scopes: { 'issues:read': { description: 'Read issues' } },
})!
const dependencies = { isSubjectEligible: async () => true }

describe('OAuth token endpoint boundary', () => {
  it('rejects non-form bodies before parsing credentials', async () => {
    const response = await handleOAuthTokenRequest(provider, {
      body: '{"grant_type":"authorization_code"}',
      contentType: 'application/json',
    }, dependencies)
    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ error: 'invalid_request' })
  })

  it('returns a protocol error for unsupported grants without touching storage', async () => {
    const response = await handleOAuthTokenRequest(provider, {
      body: 'grant_type=password&client_id=42',
      contentType: 'application/x-www-form-urlencoded; charset=utf-8',
    }, dependencies)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'unsupported_grant_type' })
  })
})
