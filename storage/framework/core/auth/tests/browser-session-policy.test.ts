import { describe, expect, test } from 'bun:test'
import { authCookieForBrowserSession, browserSessionLogoutRedirect, resolveBrowserSessionPolicy } from '../src/browser-session'

const hour = 60 * 60 * 1000
const day = 24 * hour

describe('browser session policy', () => {
  test('preserves the configured token lifetime when remember is not requested', () => {
    const policy = resolveBrowserSessionPolicy(false, {
      tokenExpiry: hour,
      browserSession: {
        baselineLifetime: 7 * day,
        rememberedLifetime: 30 * day,
      },
    })

    expect(policy).toEqual({
      remembered: false,
      lifetimeMs: 7 * day,
      expiresInMinutes: 7 * 24 * 60,
      withRefreshToken: true,
    })
  })

  test.each([true, 1, '1', 'true', 'TRUE', 'on', 'yes'])('normalizes %p as a remembered session', (remember) => {
    const policy = resolveBrowserSessionPolicy(remember, {
      tokenExpiry: hour,
      browserSession: {
        baselineLifetime: 7 * day,
        rememberedLifetime: 30 * day,
        withRefreshToken: false,
      },
    })

    expect(policy.remembered).toBe(true)
    expect(policy.lifetimeMs).toBe(30 * day)
    expect(policy.expiresInMinutes).toBe(30 * 24 * 60)
    expect(policy.withRefreshToken).toBe(false)
  })

  test.each([false, 0, null, undefined, '', 'false', 'off', 'no', 'unexpected'])('normalizes %p as a baseline session', (remember) => {
    const policy = resolveBrowserSessionPolicy(remember, {
      tokenExpiry: hour,
      browserSession: {
        baselineLifetime: 7 * day,
        rememberedLifetime: 30 * day,
      },
    })

    expect(policy.remembered).toBe(false)
    expect(policy.lifetimeMs).toBe(7 * day)
  })

  test('falls back to the existing access-token lifetime without browser-session config', () => {
    const policy = resolveBrowserSessionPolicy(true, { tokenExpiry: hour })

    expect(policy.lifetimeMs).toBe(hour)
    expect(policy.withRefreshToken).toBe(true)
  })

  test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects an invalid baseline lifetime of %p', (baselineLifetime) => {
    expect(() => resolveBrowserSessionPolicy(false, {
      tokenExpiry: hour,
      browserSession: { baselineLifetime },
    })).toThrow('browserSession.baselineLifetime')
  })

  test('rejects an invalid remembered lifetime before issuing either tier', () => {
    expect(() => resolveBrowserSessionPolicy(false, {
      tokenExpiry: hour,
      browserSession: { rememberedLifetime: 0 },
    })).toThrow('browserSession.rememberedLifetime')
  })

  test('binds cookie Max-Age to the lifetime reported by token issuance', () => {
    const cookie = authCookieForBrowserSession('12|plain-token', 604799)

    expect(cookie).toContain('Max-Age=604799')
  })

  test.each([undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])('refuses to serialize an invalid issued lifetime of %p', (expiresIn) => {
    expect(() => authCookieForBrowserSession('12|plain-token', expiresIn)).toThrow('issued token lifetime')
  })

  test('resolves a configured local redirect only for HTML navigation', () => {
    const html = new Request('https://app.example/logout', { headers: { accept: 'text/html,application/xhtml+xml' } })
    const spacedHtml = new Request('https://app.example/logout', { headers: { accept: 'text/html ;q=1, application/json;q=0.5' } })
    const json = new Request('https://app.example/logout', { headers: { accept: 'application/json' } })
    const rejectsHtml = new Request('https://app.example/logout', { headers: { accept: 'application/json, text/html;q=0' } })
    const auth = { tokenExpiry: hour, browserSession: { logoutRedirect: '/login?logged_out=1' } }

    expect(browserSessionLogoutRedirect(html, auth)).toBe('/login?logged_out=1')
    expect(browserSessionLogoutRedirect(spacedHtml, auth)).toBe('/login?logged_out=1')
    expect(browserSessionLogoutRedirect(json, auth)).toBeUndefined()
    expect(browserSessionLogoutRedirect(rejectsHtml, auth)).toBeUndefined()
  })

  test.each(['https://evil.example/login', '//evil.example/login', '/\\evil.example/login', '/a/..//evil.example/login', 'login'])('rejects unsafe logout redirect %p', (logoutRedirect) => {
    const request = new Request('https://app.example/logout', { headers: { accept: 'text/html' } })

    expect(browserSessionLogoutRedirect(request, {
      tokenExpiry: hour,
      browserSession: { logoutRedirect },
    })).toBeUndefined()
  })
})
