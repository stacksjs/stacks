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
  localStorage: (globalThis as any).localStorage,
  window: (globalThis as any).window,
  __STACKS_CONFIG__: (globalThis as any).__STACKS_CONFIG__,
  requestAnimationFrame: (globalThis as any).requestAnimationFrame,
}
;(globalThis as any).requestAnimationFrame = (fn: () => void) => { fn(); return 0 }

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
  test('persists the refresh token from a login response', async () => {
    const { useAuth } = await load()
    responders = [() => json({ token: 'access-1', refresh_token: 'refresh-1', user: { id: 1 } })]

    await useAuth().login({ email: 'a@b.co', password: 'pw' } as any)

    // The field the client used to receive and drop on the floor.
    await flush()
    expect(persisted('refresh_token')).toBe('refresh-1')
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
    expect((calls[2]!.init.headers as any).Authorization).toBe('Bearer access-2')
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
      const auth = (call.init.headers as any)?.Authorization
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

  test('does not try to refresh without a refresh token', async () => {
    seed('token', 'expired')
    const { authFetch } = await load()

    responders = [() => json({}, 401)]

    await authFetch('/api/sites')

    expect(calls.map(c => c.url)).toEqual(['https://api.test/api/sites'])
  })

  test('defaults the identity endpoint to /api/me, reachable through the views proxy', async () => {
    seed('token', 'valid')
    const { useAuth } = await load()
    responders = [() => json({ id: 1, email: 'a@b.co' })]

    await useAuth().fetchAuthUser()

    // A bare `GET /me` is swallowed by page routing in the split topology.
    expect(calls[0]!.url).toBe('https://api.test/api/me')
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
})
