import { describe, expect, it } from 'bun:test'
import type { OAuthAuthorizationConsentView } from '../src/oauth-consent'
import { handleOAuthAuthorizationPageRequest } from '../src/oauth-authorization-endpoint'
import { resolveOAuthProviderConfig } from '../src/oauth-provider'

const provider = resolveOAuthProviderConfig({
  enabled: true,
  issuer: 'https://id.example.com',
  scopes: { 'issues:read': { description: 'Read issues', resources: ['bughq'] } },
  resources: { bughq: { audience: 'https://api.bughq.example', description: 'BugHQ data' } },
})!

const requestId = 'r'.repeat(43)
const consent: OAuthAuthorizationConsentView = {
  requestId,
  client: { id: '17', name: 'Browser integration', type: 'public' },
  permissions: [{ name: 'issues:read', description: 'Read issues' }],
  resources: [{ name: 'bughq', audience: 'https://api.bughq.example', description: 'BugHQ data' }],
}

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    begin: async () => ({ requestId }),
    loadConsent: async () => consent,
    render: async (_view: string, context: Record<string, unknown>) => JSON.stringify(context),
    ...overrides,
  }
}

describe('OAuth authorization page boundary', () => {
  it('stores an initial request and sends a signed-out browser through login with only its opaque handle', async () => {
    let receivedQuery = ''
    let receivedBrowserSession = ''
    const response = await handleOAuthAuthorizationPageRequest({
      provider,
      request: new Request('https://id.example.com/oauth/authorize?response_type=code&client_id=17&state=client-state'),
      identity: null,
      dependencies: dependencies({
        begin: async (input: { query: string | URLSearchParams, browserSessionId: string }) => {
          receivedQuery = input.query.toString()
          receivedBrowserSession = input.browserSessionId
          return { requestId }
        },
      }),
    })

    expect(response.status).toBe(302)
    expect(receivedQuery).toContain('client_id=17')
    expect(receivedBrowserSession).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const location = new URL(response.headers.get('location')!, provider.issuer)
    expect(location.pathname).toBe('/login')
    expect([...location.searchParams.keys()]).toEqual(['redirect'])
    expect(location.searchParams.get('redirect')).toBe(`/oauth/authorize?request_id=${requestId}`)
    expect(location.toString()).not.toContain('client-state')
    expect(response.headers.get('set-cookie')).toContain(`=${receivedBrowserSession};`)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('renders a resumed request for server-derived display identity only', async () => {
    let renderedView = ''
    let renderedContext: Record<string, unknown> = {}
    const response = await handleOAuthAuthorizationPageRequest({
      provider,
      request: new Request(`https://id.example.com/oauth/authorize?request_id=${requestId}`, {
        headers: { cookie: `__Host-stacks-oauth-session=${'b'.repeat(43)}` },
      }),
      identity: { label: 'Ada Lovelace', workspaceLabel: 'Acme' },
      csrfToken: 'csrf-proof',
      dependencies: dependencies({
        render: async (view: string, context: Record<string, unknown>) => {
          renderedView = view
          renderedContext = context
          return '<main>Consent</main>'
        },
      }),
    })

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('<main>Consent</main>')
    expect(renderedView).toBe('auth/oauth/consent')
    expect(renderedContext).toEqual({
      consent,
      signedInIdentity: 'Ada Lovelace',
      selectedWorkspace: 'Acme',
      consentAction: 'https://id.example.com/oauth/authorize',
      csrfToken: 'csrf-proof',
    })
    expect(response.headers.get('content-security-policy')).toBe("frame-ancestors 'none'")
    expect(response.headers.get('x-frame-options')).toBe('DENY')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
  })

  it('reuses remembered consent for the authenticated subject without rendering the form', async () => {
    let rendered = false
    let reuseInput: Record<string, unknown> = {}
    const response = await handleOAuthAuthorizationPageRequest({
      provider: {
        ...provider,
        consent: { ...provider.consent, rememberFor: 60_000 },
      },
      request: new Request(`https://id.example.com/oauth/authorize?request_id=${requestId}`, {
        headers: { cookie: `__Host-stacks-oauth-session=${'b'.repeat(43)}` },
      }),
      identity: { label: 'Ada Lovelace' },
      subject: { type: 'users', id: 42, workspaceId: 'workspace-1' },
      dependencies: dependencies({
        reuseConsent: async (input: Record<string, unknown>) => {
          reuseInput = input
          return {
            ok: true,
            value: {
              code: 'c'.repeat(43),
              grantId: 'a'.repeat(32),
              redirectUri: 'https://client.example.com/callback',
              state: 'client-state',
            },
          }
        },
        render: async () => {
          rendered = true
          return '<main>Must not render</main>'
        },
      }),
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://client.example.com/callback?code=ccccccccccccccccccccccccccccccccccccccccccc&state=client-state')
    expect(reuseInput).toMatchObject({
      requestId,
      subjectType: 'users',
      subjectId: 42,
      workspaceId: 'workspace-1',
    })
    expect(rendered).toBe(false)
  })

  it('fails locally instead of redirecting malformed, expired, or mixed resume requests', async () => {
    for (const url of [
      'https://id.example.com/oauth/authorize?request_id=bad',
      `https://id.example.com/oauth/authorize?request_id=${requestId}&state=attacker`,
    ]) {
      const response = await handleOAuthAuthorizationPageRequest({
        provider,
        request: new Request(url),
        identity: null,
        dependencies: dependencies(),
      })
      expect(response.status).toBe(400)
      expect(response.headers.get('location')).toBeNull()
    }

    const expired = await handleOAuthAuthorizationPageRequest({
      provider,
      request: new Request(`https://id.example.com/oauth/authorize?request_id=${requestId}`),
      identity: null,
      dependencies: dependencies({ loadConsent: async () => null }),
    })
    expect(expired.status).toBe(400)
    expect(expired.headers.get('location')).toBeNull()
  })

  it('requires GET and a CSRF token before rendering authenticated consent', async () => {
    const wrongMethod = await handleOAuthAuthorizationPageRequest({
      provider,
      request: new Request('https://id.example.com/oauth/authorize', { method: 'POST' }),
      identity: null,
      dependencies: dependencies(),
    })
    expect(wrongMethod.status).toBe(405)

    const noCsrf = await handleOAuthAuthorizationPageRequest({
      provider,
      request: new Request(`https://id.example.com/oauth/authorize?request_id=${requestId}`),
      identity: { label: 'Ada' },
      dependencies: dependencies(),
    })
    expect(noCsrf.status).toBe(500)
  })
})
