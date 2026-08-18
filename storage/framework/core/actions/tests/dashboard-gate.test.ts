// The gate that decides who sees a staff dashboard page in production.
//
// The dev dashboard runs `auth: false` because it serves one developer on
// localhost. Deploying that unchanged publishes every staff page — for the app
// this was built for, that is student and family records. So these tests are
// written as the questions an attacker would ask, and the default answer to
// every one of them has to be "no".

import { describe, expect, test } from 'bun:test'
import { decideDashboardAccess, isAssetPath, isDelegatedRequest } from '../src/serve/dashboard-gate'

/** A validator that accepts exactly one token and nothing else. */
const onlyValid = async (token: string) => (token === 'valid-token' ? { id: 1 } : undefined)

function get(pathname: string, token?: string) {
  return { method: 'GET', pathname, token }
}

describe('deny by default', () => {
  test('refuses a dashboard page with no session', async () => {
    const decision = await decideDashboardAccess(get('/messages'), onlyValid)
    expect(decision).toEqual({ allow: false, reason: 'no-session' })
  })

  test('refuses a page a developer forgot to declare auth on', async () => {
    // The real failure mode: stx page middleware is opt-in, and zero of the
    // eleven pages in the app declared it. An unknown path must still be shut.
    for (const page of ['/events', '/gala', '/reports', '/families/2031/records', '/some-page-added-tomorrow'])
      expect((await decideDashboardAccess(get(page), onlyValid)).allow).toBe(false)
  })

  test('refuses a forged token', async () => {
    const decision = await decideDashboardAccess(get('/messages', 'forged'), onlyValid)
    expect(decision).toEqual({ allow: false, reason: 'invalid-session' })
  })

  test('refuses when the validator throws', async () => {
    // A malformed token that breaks the lookup is an invalid token, not a
    // visitor. Failing open here would turn a crash into an access grant.
    const explodes = async () => { throw new Error('malformed token') }
    const decision = await decideDashboardAccess(get('/messages', '{{'), explodes)
    expect(decision).toEqual({ allow: false, reason: 'invalid-session' })
  })

  test('refuses an empty token', async () => {
    expect((await decideDashboardAccess(get('/messages', ''), onlyValid)).allow).toBe(false)
  })

  test('admits a valid session', async () => {
    const decision = await decideDashboardAccess(get('/messages', 'valid-token'), onlyValid)
    expect(decision).toEqual({ allow: true, reason: 'authenticated' })
  })
})

describe('the allowlist', () => {
  test('lets a signed-out visitor reach the sign-in page', async () => {
    expect((await decideDashboardAccess(get('/login'), onlyValid)).reason).toBe('public-page')
  })

  test('is not widened by a trailing slash', async () => {
    expect((await decideDashboardAccess(get('/login/'), onlyValid)).allow).toBe(true)
  })

  test('cannot be reached by dressing a gated path up as a public one', async () => {
    // Prefix and suffix tricks against the allowlist.
    for (const path of ['/login/../messages', '/messages/login', '/loginx', '/login-secrets'])
      expect((await decideDashboardAccess(get(path), onlyValid)).allow).toBe(false)
  })

  test('is replaceable, and replacing it does not add anything', async () => {
    const options = { publicPaths: ['/signin'] }
    expect((await decideDashboardAccess(get('/signin'), onlyValid, options)).allow).toBe(true)
    expect((await decideDashboardAccess(get('/login'), onlyValid, options)).allow).toBe(false)
  })
})

describe('assets', () => {
  test('render for a signed-out visitor, so the sign-in page works', async () => {
    for (const asset of ['/_stx/router.js', '/favicon.ico', '/assets/app.css', '/img/logo.svg'])
      expect((await decideDashboardAccess(get(asset), onlyValid)).reason).toBe('asset')
  })

  test('a page is not an asset just because a segment above it has a dot', async () => {
    // Only the LAST segment decides, or `/v1.2/families` would read as a file
    // and skip the gate entirely.
    expect(isAssetPath('/v1.2/families')).toBe(false)
    expect((await decideDashboardAccess(get('/v1.2/families'), onlyValid)).allow).toBe(false)
  })

  test('an extensionless path is never an asset', () => {
    expect(isAssetPath('/messages')).toBe(false)
    expect(isAssetPath('/')).toBe(false)
  })
})

describe('what the router owns', () => {
  test('API paths pass through to be authenticated there', async () => {
    // These return 401 on their own terms; gating them here would either
    // double-gate or, worse, redirect a JSON call to an HTML login page.
    expect((await decideDashboardAccess(get('/api/campushq/messages'), onlyValid)).reason).toBe('delegated')
  })

  test('a path merely starting with the letters api is NOT delegated', async () => {
    expect((await decideDashboardAccess(get('/apiary'), onlyValid)).allow).toBe(false)
  })

  test('sign-in can be posted while signed out', async () => {
    expect(isDelegatedRequest('POST', '/login')).toBe(true)
  })

  test('a mutating verb never renders a page, so it belongs to the router', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'])
      expect(isDelegatedRequest(method, '/messages')).toBe(true)
  })

  test('HEAD is gated exactly like GET', async () => {
    // HEAD leaks existence and headers if it skips the gate.
    expect(isDelegatedRequest('HEAD', '/messages')).toBe(false)
    expect((await decideDashboardAccess({ method: 'HEAD', pathname: '/messages', token: undefined }, onlyValid)).allow).toBe(false)
  })
})
