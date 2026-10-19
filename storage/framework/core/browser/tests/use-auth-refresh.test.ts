/**
 * stacksjs/stacks#2235 — the framework issues an access/refresh pair on login
 * and ships `RefreshTokenAction` to exchange them, but the browser never used
 * it. `useAuth()` stored only the access token and cleared the session on any
 * non-ok response, so every app on the default composable had sessions that
 * ended when the access token expired — one hour, per `config.auth.tokenExpiry`.
 * `refresh_token` appeared exactly once in the whole client surface: as a field
 * on a TypeScript interface nothing read.
 *
 * `fetch` and `localStorage` are stubbed so this runs headless.
 */

import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

// ─── Minimal localStorage, since `useStorage` persists through it ────

const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
  clear: () => store.clear(),
}
;(globalThis as any).window = globalThis
;(globalThis as any).__STACKS_CONFIG__ = { API_URL: 'https://api.test' }
// `useStorage` flushes writes through rAF, which does not exist off-DOM.
// Run the callback SYNCHRONOUSLY so persistence lands the moment a ref is
// set: a wall-clock sleep would make these assertions a race on a loaded CI
// runner, and the thing under test has nothing to do with frame timing.
const REAL_GLOBALS = {
  document: (globalThis as any).document,
  location: (globalThis as any).location,
  localStorage: (globalThis as any).localStorage,
  window: (globalThis as any).window,
  __STACKS_CONFIG__: (globalThis as any).__STACKS_CONFIG__,
  requestAnimationFrame: (globalThis as any).requestAnimationFrame,
}
;(globalThis as any).requestAnimationFrame = (fn: () => void) => { fn(); return 0 }
;(globalThis as any).document = { cookie: 'X-CSRF-Token=csrf-proof' }
;(globalThis as any).location = { origin: 'https://api.test' }

/*
 * Put every global back.
 *
 * These are set at module scope and were never removed, so the rest of the run
 * inherited them - including a `requestAnimationFrame` that calls its callback
 * SYNCHRONOUSLY. `IntersectionObserver`'s poll loop reschedules itself from
 * inside that callback, so once any other suite had an observed element the
 * scheduler recursed until the stack overflowed, killing the process before
 * `bun test` could print a summary (stacksjs/stacks#2413).
 */
afterAll(() => {
  for (const [key, value] of Object.entries(REAL_GLOBALS)) {
    if (value === undefined)
      delete (globalThis as any)[key]
    else
      (globalThis as any)[key] = value
  }
})

/** Kept as an await point for readability; persistence is already synchronous. */
const flush = (): Promise<void> => Promise.resolve()

/** Seed a persisted value. MUST run before `load()` — the refs read at construction. */
function seed(key: string, value: string): void {
  store.set(key, JSON.stringify(value))
}

/** Read a persisted value back through useStorage's JSON encoding. */
function persisted(key: string): string {
  const raw = store.get(key)
  return raw === undefined ? '' : JSON.parse(raw)
}

function requestHeader(call: Call, name: string): string | null {
  return new Headers(call.init.headers).get(name)
}

const realFetch = globalThis.fetch

interface Call { url: string, init: RequestInit }
let calls: Call[] = []
/** Queue of responders, consumed in order; the last one repeats. */
let responders: Array<(call: Call) => Response | Promise<Response>> = []

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  store.clear()
  calls = []
  responders = []
  ;(globalThis as any).fetch = async (url: string, init: RequestInit = {}) => {
    const call = { url: String(url), init }
    calls.push(call)
    const responder = responders.length > 1 ? responders.shift()! : responders[0]
    if (!responder) return json({}, 200)
    return await responder(call)
  }
})

afterEach(() => {
  ;(globalThis as any).fetch = realFetch
})

const load = async () => {
  // Fresh module per test: the composable holds singleton state at module
  // scope, which is the point of the single-flight guard.
  const mod = await import(`../src/composables/useAuth?t=${Math.random()}`)
  return mod as typeof import('../src/composables/useAuth')
}

describe('useAuth refresh cycle (#2235)', () => {
  test('login forwards remember and leaves a 2FA challenge unauthenticated', async () => {
    const { useAuth } = await load()
    responders = [() => json({ requires_two_factor: true, challenge_token: 'challenge-1' })]

    const auth = useAuth()
    const result = await auth.login({ email: 'a@b.co', password: 'pw', remember: true })

    expect(result).toEqual({ requires_two_factor: true, challenge_token: 'challenge-1' })
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({ remember: true })
    expect(calls).toHaveLength(1)
    expect(auth.isAuthenticated.value).toBe(false)
    expect(persisted('token')).toBe('')
  })

  test('completes a 2FA challenge before storing the issued session', async () => {
    const { useAuth } = await load()
    responders = [
      () => json({
        access_token: 'access-2fa',
        refresh_token: 'refresh-2fa',
        token_type: 'Bearer',
        expires_in: 3600,
        token: 'access-2fa',
        user: { id: 1, email: 'a@b.co' },
      }),
      () => json({ id: 1, email: 'a@b.co' }),
    ]

    const result = await useAuth().verifyTwoFactorLogin('challenge-1', '123456')

    expect(result && 'token' in result && result.token).toBe('access-2fa')
    expect(calls[0]!.url).toBe('https://api.test/verify-two-factor-login')
    expect(calls[0]!.init.credentials).toBe('same-origin')
    expect(requestHeader(calls[0]!, 'X-CSRF-Token')).toBe('csrf-proof')
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ challenge_token: 'challenge-1', code: '123456' })
    expect(persisted('token')).toBe('access-2fa')
    expect(persisted('refresh_token')).toBe('refresh-2fa')
  })

  test('a malformed successful 2FA response cannot overwrite an existing session', async () => {
    seed('token', 'existing-access')
    seed('refresh_token', 'existing-refresh')
    const { useAuth } = await load()
    responders = [() => json({ token: 'poisoned-access', user: { id: 2 }, refresh_token: {} })]

    const result = await useAuth().verifyTwoFactorLogin('challenge-1', '123456')

    expect(result).toBeInstanceOf(Error)
    expect(persisted('token')).toBe('existing-access')
    expect(persisted('refresh_token')).toBe('existing-refresh')
  })

  test('the scaffold auth helper rejects malformed 2FA sessions without changing state', async () => {
    seed('token', 'existing-access')
    const { useAuth } = await import(`../../../defaults/functions/auth?t=${Math.random()}`)
    responders = [() => json({ token: null, user: null })]

    const auth = useAuth()
    const result = await auth.verifyTwoFactorLogin('challenge-1', '123456')

    expect(result).toEqual({ token: null, user: null })
    expect(auth.token.value).toBe('existing-access')
    expect(auth.isAuthenticated.value).toBe(false)
  })

  test('the scaffold auth flow rejects malformed sessions and unsafe redirects', async () => {
    const { isLoginResponse, isTwoFactorChallenge, safeAuthRedirect } = await import(`../../../defaults/functions/auth?t=${Math.random()}`)

    expect(isLoginResponse({ token: null, user: null })).toBe(false)
    expect(isLoginResponse({ token: 'access', user: { id: 1 } })).toBe(true)
    expect(isTwoFactorChallenge({ requires_two_factor: true, challenge_token: '' })).toBe(false)
    expect(isTwoFactorChallenge({ requires_two_factor: true, challenge_token: 'challenge-1' })).toBe(true)
    expect(safeAuthRedirect('/dashboard?tab=security#sessions')).toBe('/dashboard?tab=security#sessions')
    expect(safeAuthRedirect('/\\evil.example/login')).toBe('/')
    expect(safeAuthRedirect('//evil.example/login')).toBe('/')
    expect(safeAuthRedirect('https://evil.example/login')).toBe('/')
  })

  test('persists the refresh token from a login response', async () => {
    const { useAuth } = await load()
    responders = [() => json({ token: 'access-1', refresh_token: 'refresh-1', user: { id: 1 } })]

    await useAuth().login({ email: 'a@b.co', password: 'pw' } as any)

    // The field the client used to receive and drop on the floor.
    await flush()
    expect(persisted('refresh_token')).toBe('refresh-1')
  })

  test('a fixed-lifetime login clears a refresh token from an older session', async () => {
    seed('refresh_token', 'stale-refresh')
    const { useAuth } = await load()
    responders = [
      () => json({ token: 'fixed-access', user: { id: 1 } }),
      () => json({ id: 1, email: 'a@b.co' }),
    ]

    await useAuth().login({ email: 'a@b.co', password: 'pw' })

    expect(persisted('refresh_token')).toBe('')
  })

  test('a fixed-lifetime social handoff clears a refresh token from an older session', async () => {
    seed('refresh_token', 'stale-refresh')
    const { useAuth } = await load()
    responders = [() => json({ id: 1, email: 'social@b.co' })]

    await useAuth().completeSocialLogin({
      token: 'fixed-social-access',
      expiresIn: 120,
      user: { id: 1, email: 'social@b.co' },
    })

    expect(persisted('token')).toBe('fixed-social-access')
    expect(persisted('refresh_token')).toBe('')
  })

  test('a 401 refreshes and retries instead of ending the session', async () => {
    seed('token', 'expired')
    seed('refresh_token', 'refresh-1')
    const { authFetch } = await load()

    responders = [
      () => json({ error: 'Unauthorized' }, 401), // the expired access token
      () => json({ access_token: 'access-2', refresh_token: 'refresh-2' }), // the exchange
      () => json({ ok: true }), // the retry
    ]

    const res = await authFetch('/api/sites')

    expect(res.status).toBe(200)
    expect(calls.map(c => c.url)).toEqual([
      'https://api.test/api/sites',
      'https://api.test/auth/refresh',
      'https://api.test/api/sites',
    ])
    // The retry carries the NEW token, not the expired one.
    expect(requestHeader(calls[2]!, 'Authorization')).toBe('Bearer access-2')
    // Rotation is stored, so the next expiry can refresh again.
    await flush()
    expect(persisted('refresh_token')).toBe('refresh-2')
  })

  test('concurrent 401s share ONE exchange', async () => {
    // Single-use rotation makes this correctness, not performance: a second
    // exchange presenting an already-consumed token kills the session.
    seed('token', 'expired')
    seed('refresh_token', 'refresh-1')
    const { authFetch } = await load()

    let refreshCount = 0
    responders = [(call) => {
      if (call.url.endsWith('/auth/refresh')) {
        refreshCount++
        return json({ access_token: 'access-2', refresh_token: 'refresh-2' })
      }
      // Every protected call 401s until the token is replaced.
      const auth = requestHeader(call, 'Authorization')
      return auth === 'Bearer access-2' ? json({ ok: true }) : json({}, 401)
    }]

    const results = await Promise.all([
      authFetch('/api/a'),
      authFetch('/api/b'),
      authFetch('/api/c'),
    ])

    expect(results.every(r => r.status === 200)).toBe(true)
    expect(refreshCount).toBe(1)
  })

  test('a REFUSED refresh ends the session', async () => {
    seed('token', 'expired')
    seed('refresh_token', 'revoked')
    const { authFetch } = await load()

    responders = [(call) => json({ error: 'nope' }, 401 + (call.url.endsWith('/auth/refresh') ? 0 : 0))]

    const res = await authFetch('/api/sites')

    expect(res.status).toBe(401)
    // Refusal is authoritative — the tokens are gone.
    await flush()
    expect(persisted('token')).toBe('')
    expect(persisted('refresh_token')).toBe('')
  })

  test('an UNREACHABLE server keeps the session', async () => {
    // The distinction the issue is really about: signing users out on a
    // network blip loses a session that was perfectly valid.
    seed('token', 'expired')
    seed('refresh_token', 'refresh-1')
    const { refreshSession } = await load()

    responders = [() => { throw new TypeError('Failed to fetch') }]

    expect(await refreshSession()).toBe(false)
    await flush()
    expect(persisted('token')).toBe('expired')
    expect(persisted('refresh_token')).toBe('refresh-1')
  })

  test('does not try to refresh a 403', async () => {
    // 403 is an authorization decision, not an expiry; refreshing cannot
    // change it and would burn a rotation for nothing.
    seed('token', 'valid')
    seed('refresh_token', 'refresh-1')
    const { authFetch } = await load()

    responders = [() => json({ error: 'Forbidden' }, 403)]

    const res = await authFetch('/api/sites')

    expect(res.status).toBe(403)
    expect(calls).toHaveLength(1)
  })

  test('does not try to refresh without a refresh token, and confirms with /me instead', async () => {
    seed('token', 'expired')
    const { authFetch } = await load()

    responders = [() => json({}, 401)]

    await authFetch('/api/sites')

    // No exchange to attempt; the 401 is checked against the identity
    // endpoint, whose own 401 is what ends the session.
    expect(calls.map(c => c.url)).toEqual(['https://api.test/api/sites', 'https://api.test/api/me'])
    expect(persisted('token')).toBe('')
  })

  test('defaults the identity endpoint to /api/me, reachable through the views proxy', async () => {
    seed('token', 'valid')
    const { useAuth } = await load()
    responders = [() => json({ id: 1, email: 'a@b.co' })]

    await useAuth().fetchAuthUser()

    // A bare `GET /me` is swallowed by page routing in the split topology.
    expect(calls[0]!.url).toBe('https://api.test/api/me')
  })

  test('a cookie-only session can hydrate the authenticated user', async () => {
    const { useAuth } = await load()
    responders = [() => json({ id: 1, email: 'cookie@b.co' })]

    const resolved = await useAuth().fetchAuthUser()

    expect(resolved).toEqual({ id: 1, email: 'cookie@b.co' })
    expect(calls).toHaveLength(1)
    expect(calls[0]!.init.credentials).toBe('same-origin')
    expect(requestHeader(calls[0]!, 'Authorization')).toBeNull()
  })

  test('a cookie-only session can log out with the seeded CSRF token', async () => {
    const { useAuth } = await load()
    responders = [() => json({ message: 'Successfully logged out' })]

    await useAuth().logout()

    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('https://api.test/logout')
    expect(calls[0]!.init.credentials).toBe('same-origin')
    expect(requestHeader(calls[0]!, 'X-CSRF-Token')).toBe('csrf-proof')
    expect(requestHeader(calls[0]!, 'Authorization')).toBeNull()
  })

  test('a cookie-only mutation through authFetch echoes the seeded CSRF token', async () => {
    const { authFetch } = await load()
    responders = [() => json({ updated: true })]

    const res = await authFetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Cookie User' }),
    })

    expect(res.status).toBe(200)
    expect(calls[0]!.init.credentials).toBe('same-origin')
    expect(requestHeader(calls[0]!, 'X-CSRF-Token')).toBe('csrf-proof')
    expect(requestHeader(calls[0]!, 'Authorization')).toBeNull()
  })

  test('authFetch never forwards the page CSRF token to another origin', async () => {
    const { authFetch } = await load()
    responders = [() => json({ updated: true })]

    await authFetch('https://external.example/profile', { method: 'PATCH' })

    expect(requestHeader(calls[0]!, 'X-CSRF-Token')).toBeNull()
  })

  test('authFetch preserves a caller-supplied CSRF header case-insensitively', async () => {
    const { authFetch } = await load()
    responders = [() => json({ updated: true })]

    await authFetch('/api/profile', {
      method: 'PATCH',
      headers: { 'x-csrf-token': 'caller-proof' },
    })

    const headers = new Headers(calls[0]!.init.headers)
    expect(headers.get('X-CSRF-Token')).toBe('caller-proof')
    expect([...headers.keys()].filter(name => name === 'x-csrf-token')).toHaveLength(1)
  })

  test('logout clears the refresh token too', async () => {
    seed('token', 'valid')
    seed('refresh_token', 'refresh-1')
    const { useAuth } = await load()
    responders = [() => json({ ok: true })]

    await useAuth().logout()

    // Leaving it behind would let a later refresh resurrect a session the
    // user just ended.
    await flush()
    expect(persisted('refresh_token')).toBe('')
  })

  test('a refused logout preserves local credentials and reports failure', async () => {
    seed('token', 'still-valid')
    seed('refresh_token', 'still-refreshable')
    const { useAuth } = await load()
    responders = [() => json({ message: 'CSRF token mismatch' }, 403)]

    await expect(useAuth().logout()).rejects.toThrow('Logout failed with status 403')

    await flush()
    expect(persisted('token')).toBe('still-valid')
    expect(persisted('refresh_token')).toBe('still-refreshable')
  })

  test('an unreachable logout preserves local credentials and reports failure', async () => {
    seed('token', 'still-valid')
    seed('refresh_token', 'still-refreshable')
    const { useAuth } = await load()
    responders = [() => { throw new TypeError('Failed to fetch') }]

    await expect(useAuth().logout()).rejects.toThrow('Failed to fetch')

    await flush()
    expect(persisted('token')).toBe('still-valid')
    expect(persisted('refresh_token')).toBe('still-refreshable')
  })
})

/**
 * `/api/me` failures that are not a 401 used to clear the session too: a
 * network blip set `isAuthenticated` false and `user` null, and `authGuard`
 * then sent a signed-in user to /login. Only a 401 is the server saying the
 * credential is no good.
 */
describe('useAuth session resilience', () => {
  const ME = 'https://api.test/api/me'

  /** A responder that answers /me with `me` and everything else with `other`. */
  function route(me: (call: Call) => Response | Promise<Response>, other: (call: Call) => Response | Promise<Response> = () => json({ ok: true })) {
    return (call: Call) => call.url === ME ? me(call) : other(call)
  }

  async function signedIn() {
    seed('token', 'access-1')
    const mod = await load()
    responders = [() => json({ id: 1, email: 'a@b.co', roles: ['coach'] })]
    const auth = mod.useAuth()
    await auth.fetchAuthUser()
    expect(auth.isAuthenticated.value).toBe(true)
    calls = []
    return { mod, auth }
  }

  test('a network failure on /me keeps the token and the user', async () => {
    const { auth } = await signedIn()
    const before = auth.user.value
    responders = [() => { throw new TypeError('Failed to fetch') }]

    const result = await auth.fetchAuthUser()

    expect(result).toBe(before)
    expect(auth.user.value).toBe(before)
    expect(auth.isAuthenticated.value).toBe(true)
    expect(persisted('token')).toBe('access-1')
  })

  test.each([500, 502, 503, 403, 404])('a %d on /me keeps the session', async (status) => {
    const { auth } = await signedIn()
    const before = auth.user.value
    responders = [() => json({ error: 'nope' }, status)]

    expect(await auth.fetchAuthUser()).toBe(before)
    expect(auth.isAuthenticated.value).toBe(true)
    expect(persisted('token')).toBe('access-1')
  })

  test('a 401 on /me ends the session and tells listeners once', async () => {
    const { auth } = await signedIn()
    const events: unknown[] = []
    auth.onSessionExpired(event => events.push(event))
    responders = [() => json({ error: 'Unauthorized' }, 401)]

    expect(await auth.fetchAuthUser()).toBeNull()
    expect(auth.user.value).toBeNull()
    expect(auth.isAuthenticated.value).toBe(false)
    expect(persisted('token')).toBe('')
    expect(events).toEqual([{ reason: 'unauthorized', status: 401, url: ME }])
  })

  test('concurrent callers share one /me request', async () => {
    seed('token', 'access-1')
    const { useAuth } = await load()
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    responders = [async () => {
      await gate
      return json({ id: 1, email: 'a@b.co' })
    }]

    const auth = useAuth()
    const pending = [auth.fetchAuthUser(), auth.fetchAuthUser(), useAuth().checkAuthentication()]
    release()
    const [first, second, checked] = await Promise.all(pending)

    expect(calls.filter(c => c.url === ME)).toHaveLength(1)
    expect(first).toBe(second as any)
    expect(checked).toBe(true)

    // Settled requests are not cached: the next call asks again.
    await auth.fetchAuthUser()
    expect(calls.filter(c => c.url === ME)).toHaveLength(2)
  })

  test('an unchanged /me answer keeps the same user object', async () => {
    const { auth } = await signedIn()
    const before = auth.user.value
    responders = [() => json({ id: 1, email: 'a@b.co', roles: ['coach'] })]

    await auth.fetchAuthUser()
    expect(auth.user.value).toBe(before)

    responders = [() => json({ id: 1, email: 'a@b.co', roles: ['coach', 'admin'] })]
    await auth.fetchAuthUser()
    expect(auth.user.value).not.toBe(before)
    expect(auth.user.value).toEqual({ id: 1, email: 'a@b.co', roles: ['coach', 'admin'] } as any)
  })

  test('a burst of 401s checks /me once and ends the session once', async () => {
    const { mod, auth } = await signedIn()
    let expired = 0
    auth.onSessionExpired(() => { expired++ })
    responders = [() => json({ error: 'Unauthorized' }, 401)]

    const results = await Promise.all(['/api/a', '/api/b', '/api/c', '/api/d'].map(path => mod.authFetch(path)))

    expect(results.every(r => r.status === 401)).toBe(true)
    expect(calls.filter(c => c.url === ME)).toHaveLength(1)
    expect(expired).toBe(1)
    expect(persisted('token')).toBe('')

    // Requests after the session ended have nothing to end.
    await mod.authFetch('/api/e')
    expect(expired).toBe(1)
  })

  test('a 401 the identity check contradicts keeps the session', async () => {
    // A tampered signed URL or a step-up check answers 401 about the request,
    // not the session.
    const { mod, auth } = await signedIn()
    const before = auth.user.value
    responders = [route(() => json({ id: 1, email: 'a@b.co', roles: ['coach'] }), () => json({ error: 'Invalid signature' }, 401))]

    const res = await mod.authFetch('/api/signed/download')

    expect(res.status).toBe(401)
    expect(auth.isAuthenticated.value).toBe(true)
    expect(auth.user.value).toBe(before)
    expect(persisted('token')).toBe('access-1')
  })

  test('a 401 from another origin is not taken as a sign-out', async () => {
    const { mod, auth } = await signedIn()
    responders = [() => json({}, 401)]

    await mod.authFetch('https://elsewhere.example/api/thing')

    expect(calls.map(c => c.url)).toEqual(['https://elsewhere.example/api/thing'])
    expect(auth.isAuthenticated.value).toBe(true)
  })

  test('a 5xx from the refresh endpoint keeps the session', async () => {
    seed('token', 'expired')
    seed('refresh_token', 'refresh-1')
    const { refreshSession } = await load()
    responders = [() => json({ error: 'Bad Gateway' }, 502)]

    expect(await refreshSession()).toBe(false)
    expect(persisted('token')).toBe('expired')
    expect(persisted('refresh_token')).toBe('refresh-1')
  })

  test('an unreachable refresh during /me keeps the session', async () => {
    seed('token', 'expired')
    seed('refresh_token', 'refresh-1')
    const { useAuth } = await load()
    responders = [call => call.url.endsWith('/auth/refresh') ? json({}, 503) : json({}, 401)]

    await useAuth().fetchAuthUser()

    expect(persisted('token')).toBe('expired')
    expect(persisted('refresh_token')).toBe('refresh-1')
  })

  test('a refused refresh across a burst ends the session once', async () => {
    seed('token', 'expired')
    seed('refresh_token', 'revoked')
    const { authFetch, onSessionExpired } = await load()
    const events: Array<{ reason: string }> = []
    onSessionExpired(event => events.push(event))
    responders = [() => json({ error: 'Unauthorized' }, 401)]

    await Promise.all([authFetch('/api/a'), authFetch('/api/b'), authFetch('/api/c')])

    expect(calls.filter(c => c.url.endsWith('/auth/refresh'))).toHaveLength(1)
    expect(events.map(e => e.reason)).toEqual(['refresh-refused'])
    expect(persisted('refresh_token')).toBe('')
  })

  test('a 401 for a request sent before a new sign-in does not end the new session', async () => {
    seed('token', 'old-access')
    const { useAuth, authFetch } = await load()
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    responders = [async (call) => {
      if (call.url.endsWith('/api/slow')) {
        await gate
        return json({}, 401)
      }
      if (call.url.endsWith('/login'))
        return json({ token: 'new-access', user: { id: 2 } })
      return json({ id: 2, email: 'new@b.co' })
    }]

    const slow = authFetch('/api/slow')
    await useAuth().login({ email: 'new@b.co', password: 'pw' })
    release()
    await slow

    expect(persisted('token')).toBe('new-access')
    expect(useAuth().isAuthenticated.value).toBe(true)
  })

  describe('authGuard', () => {
    let replaced: string[] = []
    let savedLocation: unknown

    beforeEach(() => {
      replaced = []
      savedLocation = (globalThis as any).location
      ;(globalThis as any).location = {
        origin: 'https://api.test',
        pathname: '/dashboard',
        hash: '',
        replace: (to: string) => { replaced.push(to) },
      }
    })

    afterEach(() => {
      ;(globalThis as any).location = savedLocation
    })

    test('a stored token survives a network failure on page load', async () => {
      seed('token', 'access-1')
      const { authGuard, useAuth } = await load()
      responders = [() => { throw new TypeError('Failed to fetch') }]

      authGuard()
      await useAuth().fetchAuthUser()

      expect(replaced).toEqual([])
      expect(persisted('token')).toBe('access-1')
    })

    test('a stored token the server refuses redirects once', async () => {
      seed('token', 'revoked')
      const { authGuard, authFetch, useAuth } = await load()
      responders = [() => json({}, 401)]

      authGuard()
      authGuard()
      await useAuth().fetchAuthUser()
      await Promise.all([authFetch('/api/a'), authFetch('/api/b')])

      expect(replaced).toEqual(['/login'])
    })

    test('no credential at all still redirects immediately', async () => {
      const { authGuard } = await load()

      authGuard()

      expect(replaced).toEqual(['/login'])
      expect(calls).toHaveLength(0)
    })
  })
})

/**
 * The default social callback redirects with a one-use code
 * (`#stx_handoff=<64 hex>`) instead of tokens in the fragment.
 * `completeSocialLogin()` strips it, redeems it at /auth/handoff and stores the
 * session the server returns.
 */
describe('completeSocialLogin with a one-use code', () => {
  const CODE = 'a'.repeat(64)
  let savedLocation: unknown
  let savedHistory: unknown
  let replacedUrls: string[] = []

  beforeEach(() => {
    replacedUrls = []
    savedLocation = (globalThis as any).location
    savedHistory = (globalThis as any).history
    ;(globalThis as any).location = {
      origin: 'https://api.test',
      pathname: '/welcome',
      search: '?from=github',
      hash: `#stx_handoff=${CODE}&tab=profile`,
      replace: () => {},
    }
    ;(globalThis as any).history = {
      replaceState: (_state: unknown, _title: string, url: string) => {
        replacedUrls.push(url)
        ;(globalThis as any).location.hash = url.includes('#') ? url.slice(url.indexOf('#')) : ''
      },
    }
  })

  afterEach(() => {
    ;(globalThis as any).location = savedLocation
    ;(globalThis as any).history = savedHistory
  })

  test('redeems the code and stores the returned session', async () => {
    const { useAuth } = await load()
    responders = [
      (call) => {
        // The code is out of the address bar before it is sent anywhere.
        expect(replacedUrls).toEqual(['/welcome?from=github#tab=profile'])
        expect(call.url).toBe('https://api.test/auth/handoff')
        return json({
          access_token: 'social-access',
          refresh_token: 'social-refresh',
          token_type: 'Bearer',
          expires_in: 3600,
          token: 'social-access',
          user: { id: 7, email: 'gh@b.co', name: 'GH' },
        })
      },
      () => json({ id: 7, email: 'gh@b.co', name: 'GH' }),
    ]

    const auth = useAuth()
    const user = await auth.completeSocialLogin()

    expect(calls[0]!.init.method).toBe('POST')
    expect(calls[0]!.init.credentials).toBe('include')
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ code: CODE })
    expect(requestHeader(calls[0]!, 'Content-Type')).toBe('application/json')
    expect(requestHeader(calls[0]!, 'Accept')).toBe('application/json')
    expect(calls[1]!.url).toBe('https://api.test/api/me')
    expect(requestHeader(calls[1]!, 'Authorization')).toBe('Bearer social-access')
    expect(user).toEqual({ id: 7, email: 'gh@b.co', name: 'GH' })
    expect(persisted('token')).toBe('social-access')
    expect(persisted('refresh_token')).toBe('social-refresh')
    expect(auth.isAuthenticated.value).toBe(true)
  })

  test.each([
    ['a refused code', () => json({ message: 'Invalid or expired code' }, 400)],
    ['a malformed answer', () => json({ token: '', user: null })],
    ['a network failure', () => { throw new TypeError('Failed to fetch') }],
  ])('%s leaves the existing session alone', async (_label, responder) => {
    seed('token', 'existing-access')
    seed('refresh_token', 'existing-refresh')
    const { useAuth } = await load()
    responders = [responder as (call: Call) => Response]

    const result = await useAuth().completeSocialLogin()

    expect(result).toBeNull()
    expect(calls).toHaveLength(1)
    expect(replacedUrls).toEqual(['/welcome?from=github#tab=profile'])
    expect(persisted('token')).toBe('existing-access')
    expect(persisted('refresh_token')).toBe('existing-refresh')
  })

  test('a stx_auth pack from a custom callback still works', async () => {
    const { encodeSessionHandoff } = await import('@stacksjs/composables')
    ;(globalThis as any).location.hash = `#stx_auth=${encodeSessionHandoff({ token: 'pack-access', user: { id: 3 } })}`
    const { useAuth } = await load()
    responders = [() => json({ id: 3, email: 'p@b.co' })]

    const user = await useAuth().completeSocialLogin()

    expect(calls.map(c => c.url)).toEqual(['https://api.test/api/me'])
    expect(user).toEqual({ id: 3, email: 'p@b.co' } as any)
    expect(persisted('token')).toBe('pack-access')
    expect(replacedUrls).toEqual(['/welcome?from=github'])
  })
})
