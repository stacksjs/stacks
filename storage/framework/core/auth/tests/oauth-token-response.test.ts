import { describe, expect, it } from 'bun:test'
import {
  oauthTokenErrorResponse,
  oauthTokenExchangeResponse,
} from '../src/oauth-token-response'

const pair = {
  accessToken: 'access-secret',
  refreshToken: 'refresh-secret',
  tokenType: 'Bearer' as const,
  expiresIn: 3600,
  grantId: '0123456789abcdef0123456789abcdef',
  clientId: 42,
  subjectType: 'users',
  subjectId: 7,
  scopes: ['issues:read', 'profile:read'],
  resources: ['bughq'],
  audiences: ['https://api.bughq.example'],
  workspaceId: 'workspace-1',
}

describe('OAuth token responses', () => {
  it('returns only protocol fields and forbids caching successful credentials', async () => {
    const response = oauthTokenExchangeResponse({ ok: true, value: pair })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('pragma')).toBe('no-cache')
    expect(await response.json()).toEqual({
      access_token: 'access-secret',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'refresh-secret',
      scope: 'issues:read profile:read',
    })
  })

  it('omits an absent refresh token instead of serializing internal context', async () => {
    const { refreshToken: _refreshToken, ...accessOnly } = pair
    const response = oauthTokenExchangeResponse({ ok: true, value: accessOnly })
    const body = await response.json() as Record<string, unknown>
    expect(body.refresh_token).toBeUndefined()
    expect(body.grantId).toBeUndefined()
    expect(body.subjectId).toBeUndefined()
    expect(body.workspaceId).toBeUndefined()
  })

  it('maps grant failures to cache-safe protocol errors', async () => {
    const response = oauthTokenExchangeResponse({ ok: false, reason: 'invalid_grant' })
    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('pragma')).toBe('no-cache')
    expect(response.headers.get('www-authenticate')).toBeNull()
    expect(await response.json()).toEqual({ error: 'invalid_grant' })
  })

  it('challenges failed Basic client authentication without leaking details', async () => {
    const response = oauthTokenExchangeResponse(
      { ok: false, reason: 'invalid_client' },
      { clientAuthenticatedWithBasic: true },
    )
    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toBe('Basic realm="oauth-token"')
    expect(await response.json()).toEqual({ error: 'invalid_client' })
  })

  it('maps request-parser failures through the same no-store boundary', async () => {
    const response = oauthTokenErrorResponse('unsupported_grant_type')
    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ error: 'unsupported_grant_type' })
  })
})
