import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import {
  clearOAuthFlowCookie,
  consumeOAuthFlow,
  issueOAuthFlow,
  memoryOAuthFlowStore,
  oauthFlowCookieName,
  oauthFlowDigest,
  readOAuthFlowCookie,
  useOAuthFlowStore,
} from '../src/flows'

/**
 * Login CSRF: a callback that exchanges any `code` signs the victim into the
 * attacker's account. These pin the properties that stop it - the state is
 * single use, bound to the browser that started the flow, scoped to one
 * purpose, and short-lived - against the in-memory store. The database store
 * is exercised end to end in core/auth/tests/session-handoff.test.ts.
 */

let store: ReturnType<typeof memoryOAuthFlowStore>

beforeEach(() => {
  store = memoryOAuthFlowStore()
  useOAuthFlowStore(store)
})

afterEach(() => {
  useOAuthFlowStore(null)
})

function cookieValue(setCookie: string | null): string {
  return String(setCookie).split(';')[0]!.split('=')[1]!
}

describe('issueOAuthFlow', () => {
  it('stores digests only, never the raw state or secret', async () => {
    const flow = await issueOAuthFlow({ purpose: 'social:github', ttlMs: 60_000 })

    expect(flow.state).toMatch(/^[a-f0-9]{64}$/)
    expect(flow.secret).toMatch(/^[a-f0-9]{64}$/)
    const [record] = [...store.records.values()]
    expect(record!.stateDigest).toBe(oauthFlowDigest(flow.state))
    expect(record!.browserDigest).toBe(oauthFlowDigest(flow.secret!))
    expect(JSON.stringify(record)).not.toContain(flow.state)
    expect(JSON.stringify(record)).not.toContain(flow.secret)
  })

  it('binds the browser with an HttpOnly cookie named per flow', async () => {
    const flow = await issueOAuthFlow({ purpose: 'social:github', ttlMs: 600_000 })

    expect(flow.cookie).toContain(`${oauthFlowCookieName(flow.state)}=${flow.secret}`)
    expect(flow.cookie).toContain('HttpOnly')
    expect(flow.cookie).toContain('SameSite=Lax')
    expect(flow.cookie).toContain('Max-Age=600')
    expect(cookieValue(flow.cookie)).toBe(flow.secret!)
  })

  it('forces Secure on a SameSite=None cookie (Apple form_post)', async () => {
    const flow = await issueOAuthFlow({ purpose: 'social:apple', ttlMs: 60_000, cookie: { sameSite: 'None', secure: false } })
    expect(flow.cookie).toContain('SameSite=None')
    expect(flow.cookie).toContain('Secure')
  })

  it('mints a nonce on request and returns it again on consume', async () => {
    const flow = await issueOAuthFlow({ purpose: 'social:apple', ttlMs: 60_000, nonce: true })
    expect(flow.nonce).toMatch(/^[a-f0-9]{64}$/)

    const consumed = await consumeOAuthFlow(flow.state, { purpose: 'social:apple', browserSecret: flow.secret })
    expect(consumed?.nonce).toBe(flow.nonce!)
  })

  it('caps the lifetime at an hour and rejects nonsense options', async () => {
    const flow = await issueOAuthFlow({ purpose: 'p', ttlMs: 24 * 60 * 60_000 })
    expect(flow.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(60 * 60_000)

    await expect(issueOAuthFlow({ purpose: '', ttlMs: 1000 })).rejects.toThrow(TypeError)
    await expect(issueOAuthFlow({ purpose: 'p', ttlMs: 0 })).rejects.toThrow(TypeError)
    await expect(issueOAuthFlow({ purpose: 'p', ttlMs: 1000, challenge: 'not-a-digest' })).rejects.toThrow(TypeError)
    await expect(issueOAuthFlow({ purpose: 'p', ttlMs: 1000, userId: -1 })).rejects.toThrow(TypeError)
  })

  it('prunes expired flows as it issues', async () => {
    const stale = await issueOAuthFlow({ purpose: 'p', ttlMs: 1 })
    await Bun.sleep(5)
    await issueOAuthFlow({ purpose: 'p', ttlMs: 60_000 })
    expect(store.records.has(oauthFlowDigest(stale.state))).toBe(false)
    expect(store.records.size).toBe(1)
  })
})

describe('consumeOAuthFlow', () => {
  it('redeems once, with the data it was issued with', async () => {
    const flow = await issueOAuthFlow({ purpose: 'social:github', ttlMs: 60_000, userId: 9, data: { redirectTo: '/account' } })

    const first = await consumeOAuthFlow(flow.state, { purpose: 'social:github', browserSecret: flow.secret })
    expect(first).toMatchObject({ purpose: 'social:github', userId: 9, data: { redirectTo: '/account' } })

    expect(await consumeOAuthFlow(flow.state, { purpose: 'social:github', browserSecret: flow.secret })).toBeNull()
  })

  it('refuses another browser, and does not burn the real one', async () => {
    const flow = await issueOAuthFlow({ purpose: 'social:github', ttlMs: 60_000 })

    // The attack: the attacker's own flow state, replayed in the victim's browser.
    expect(await consumeOAuthFlow(flow.state, { purpose: 'social:github', browserSecret: 'f'.repeat(64) })).toBeNull()
    expect(await consumeOAuthFlow(flow.state, { purpose: 'social:github' })).toBeNull()
    expect(await consumeOAuthFlow(flow.state, { purpose: 'social:github', browserSecret: '' })).toBeNull()

    expect(await consumeOAuthFlow(flow.state, { purpose: 'social:github', browserSecret: flow.secret })).not.toBeNull()
  })

  it('refuses a state issued for another purpose without consuming it', async () => {
    const flow = await issueOAuthFlow({ purpose: 'social:google', ttlMs: 60_000 })

    expect(await consumeOAuthFlow(flow.state, { purpose: 'social:apple', browserSecret: flow.secret })).toBeNull()
    expect(await consumeOAuthFlow(flow.state, { purpose: 'social:google', browserSecret: flow.secret })).not.toBeNull()
  })

  it('refuses and removes an expired flow', async () => {
    const flow = await issueOAuthFlow({ purpose: 'p', ttlMs: 1 })
    await Bun.sleep(5)

    expect(await consumeOAuthFlow(flow.state, { purpose: 'p', browserSecret: flow.secret })).toBeNull()
    expect(store.records.size).toBe(0)
  })

  it('refuses malformed and unknown states before touching the store', async () => {
    for (const state of [undefined, null, 42, '', 'abc', 'G'.repeat(64), 'a'.repeat(64)])
      expect(await consumeOAuthFlow(state, { purpose: 'p', browserSecret: 'x' })).toBeNull()
  })

  it('lets exactly one of two concurrent redemptions win', async () => {
    const flow = await issueOAuthFlow({ purpose: 'p', ttlMs: 60_000 })
    const results = await Promise.all([
      consumeOAuthFlow(flow.state, { purpose: 'p', browserSecret: flow.secret }),
      consumeOAuthFlow(flow.state, { purpose: 'p', browserSecret: flow.secret }),
    ])
    expect(results.filter(Boolean)).toHaveLength(1)
  })

  it('binds to a PKCE-style verifier instead of a cookie', async () => {
    const verifier = 'native-app-verifier-0123456789abcdef0123456789abcdef'
    const challenge = createHash('sha256').update(verifier).digest('hex')
    const flow = await issueOAuthFlow({ purpose: 'session-handoff', ttlMs: 60_000, userId: 3, challenge })

    expect(flow.cookie).toBeNull()
    expect(await consumeOAuthFlow(flow.state, { purpose: 'session-handoff', browserSecret: 'wrong' })).toBeNull()
    expect(await consumeOAuthFlow(flow.state, { purpose: 'session-handoff', browserSecret: verifier })).toMatchObject({ userId: 3 })
  })

  it('an explicitly unbound flow redeems on the state alone', async () => {
    const flow = await issueOAuthFlow({ purpose: 'p', ttlMs: 60_000, bindBrowser: false })
    expect(flow.cookie).toBeNull()
    expect(await consumeOAuthFlow(flow.state, { purpose: 'p' })).not.toBeNull()
  })
})

describe('the flow cookie', () => {
  it('is read back from a Cookie header by its per-flow name', async () => {
    const a = await issueOAuthFlow({ purpose: 'p', ttlMs: 60_000 })
    const b = await issueOAuthFlow({ purpose: 'p', ttlMs: 60_000 })
    const header = `theme=dark; ${String(a.cookie).split(';')[0]}; ${String(b.cookie).split(';')[0]}`

    expect(readOAuthFlowCookie(header, a.state)).toBe(a.secret!)
    expect(readOAuthFlowCookie(header, b.state)).toBe(b.secret!)
    expect(readOAuthFlowCookie(header, 'c'.repeat(64))).toBe('')
    expect(readOAuthFlowCookie(null, a.state)).toBe('')
  })

  it('is cleared with an expired cookie of the same name and attributes', async () => {
    const flow = await issueOAuthFlow({ purpose: 'p', ttlMs: 60_000 })
    const cleared = await clearOAuthFlowCookie(flow.state, { sameSite: 'None' })
    expect(cleared).toStartWith(`${oauthFlowCookieName(flow.state)}=;`)
    expect(cleared).toContain('Max-Age=0')
    expect(cleared).toContain('SameSite=None')
    expect(cleared).toContain('Secure')
  })
})
