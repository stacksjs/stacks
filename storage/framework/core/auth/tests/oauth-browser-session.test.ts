import { describe, expect, it } from 'bun:test'
import { resolveOAuthProviderConfig } from '../src/oauth-provider'
import {
  oauthAuthorizationBrowserSession,
  oauthAuthorizationBrowserSessionCookieName,
} from '../src/oauth-browser-session'

const httpsProvider = resolveOAuthProviderConfig({
  enabled: true,
  issuer: 'https://id.example.com',
  lifetimes: { authorizationRequest: 90_500 },
})!

const localProvider = resolveOAuthProviderConfig({
  enabled: true,
  issuer: 'http://127.0.0.1:3100',
})!

describe('OAuth authorization browser session', () => {
  it('mints a host-only, HttpOnly binding cookie for an HTTPS provider', () => {
    const session = oauthAuthorizationBrowserSession(new Request('https://id.example.com/oauth/authorize'), httpsProvider)

    expect(session.id).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(session.cookie).toContain(`__Host-stacks-oauth-session=${session.id}`)
    expect(session.cookie).toContain('Path=/')
    expect(session.cookie).toContain('HttpOnly')
    expect(session.cookie).toContain('Secure')
    expect(session.cookie).toContain('SameSite=Lax')
    expect(session.cookie).toContain('Max-Age=91')
    expect(session.cookie).not.toContain('Domain=')
  })

  it('reuses and refreshes one valid binding from the exact cookie name', () => {
    const id = 'a'.repeat(43)
    const request = new Request('https://id.example.com/oauth/authorize', {
      headers: { cookie: `theme=dark; ${oauthAuthorizationBrowserSessionCookieName(httpsProvider)}=${id}; other=value` },
    })
    const session = oauthAuthorizationBrowserSession(request, httpsProvider)

    expect(session.id).toBe(id)
    expect(session.cookie).toContain(`=${id};`)
    expect(session.cookie).toContain('Max-Age=91')
  })

  it('fails closed on malformed or duplicate bindings', () => {
    const name = oauthAuthorizationBrowserSessionCookieName(httpsProvider)
    for (const cookie of [
      `${name}=too-short`,
      `${name}=${'a'.repeat(43)}; ${name}=${'b'.repeat(43)}`,
      `prefix-${name}=${'a'.repeat(43)}`,
    ]) {
      const session = oauthAuthorizationBrowserSession(new Request('https://id.example.com/oauth/authorize', {
        headers: { cookie },
      }), httpsProvider)
      expect(session.id).toMatch(/^[A-Za-z0-9_-]{43}$/)
      expect(session.id).not.toBe('a'.repeat(43))
      expect(session.id).not.toBe('b'.repeat(43))
    }
  })

  it('uses a non-prefixed development cookie only for a loopback HTTP issuer', () => {
    const session = oauthAuthorizationBrowserSession(new Request('http://127.0.0.1:3100/oauth/authorize'), localProvider)

    expect(oauthAuthorizationBrowserSessionCookieName(localProvider)).toBe('stacks-oauth-session')
    expect(session.cookie).toContain(`stacks-oauth-session=${session.id}`)
    expect(session.cookie).not.toContain('Secure')
  })
})
