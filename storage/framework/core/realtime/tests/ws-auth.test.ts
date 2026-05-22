import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { getWsAuthenticator, handleWebSocketRequest, setWsAuthenticator } from '../src/ws'
import { setServer } from '../src/server-instance'

// stacksjs/stacks#1877 R-1 — pins the contract that WebSocket
// handshakes can be gated by an app-installed authenticator BEFORE
// the upgrade goes through. Without an authenticator, the legacy
// "unauthed upgrade" behavior is preserved.

// Minimal Bun.Server mock for upgrade testing.
function mockServer(): { upgrade: (req: Request, opts?: { data?: unknown }) => boolean, lastUpgradeOpts: { data?: unknown } | undefined } {
  let lastUpgradeOpts: { data?: unknown } | undefined
  return {
    upgrade(_req: Request, opts?: { data?: unknown }) {
      lastUpgradeOpts = opts
      return true // pretend the upgrade succeeded
    },
    get lastUpgradeOpts() {
      return lastUpgradeOpts
    },
  } as any
}

describe('WebSocket handshake auth (stacksjs/stacks#1877 R-1)', () => {
  beforeEach(() => {
    setWsAuthenticator(null)
    // Stub a "broadcast server" so handleWebSocketRequest doesn't 500.
    setServer({ start: async () => {}, stop: async () => {} } as any)
  })

  afterEach(() => {
    setWsAuthenticator(null)
  })

  test('unauthed upgrade proceeds when no authenticator is installed', async () => {
    const req = new Request('http://example.com/ws')
    const server = mockServer()
    const result = await handleWebSocketRequest(req, server as any)
    expect(result).toBeUndefined() // undefined = upgrade succeeded
  })

  test('installed authenticator gates the upgrade', async () => {
    setWsAuthenticator(() => ({ ok: false, status: 401, message: 'no token' }))

    const req = new Request('http://example.com/ws')
    const server = mockServer()
    const result = await handleWebSocketRequest(req, server as any)
    expect(result).toBeInstanceOf(Response)
    expect(result!.status).toBe(401)
    expect(await result!.text()).toBe('no token')
  })

  test('default status is 401 when authenticator denies without explicit status', async () => {
    setWsAuthenticator(() => ({ ok: false }))
    const result = await handleWebSocketRequest(new Request('http://example.com/ws'), mockServer() as any)
    expect((result as Response).status).toBe(401)
    expect(await (result as Response).text()).toBe('Unauthorized')
  })

  test('auth-pass attaches data to the upgrade', async () => {
    setWsAuthenticator(() => ({ ok: true, data: { userId: 42, role: 'admin' } }))
    const server = mockServer()
    const result = await handleWebSocketRequest(new Request('http://example.com/ws'), server as any)
    expect(result).toBeUndefined()
    expect(server.lastUpgradeOpts).toEqual({ data: { userId: 42, role: 'admin' } })
  })

  test('async authenticator is awaited', async () => {
    setWsAuthenticator(async () => {
      await new Promise(r => setTimeout(r, 10))
      return { ok: true, data: { delayed: true } }
    })
    const server = mockServer()
    const result = await handleWebSocketRequest(new Request('http://example.com/ws'), server as any)
    expect(result).toBeUndefined()
    expect(server.lastUpgradeOpts).toEqual({ data: { delayed: true } })
  })

  test('authenticator throw → 500 (don\'t leak internals)', async () => {
    setWsAuthenticator(() => {
      throw new Error('internal db hiccup')
    })

    const orig = console.error
    const errors: string[] = []
    console.error = (...args: unknown[]) => { errors.push(args.join(' ')) }
    try {
      const result = await handleWebSocketRequest(new Request('http://example.com/ws'), mockServer() as any)
      expect((result as Response).status).toBe(500)
      expect(await (result as Response).text()).toBe('WebSocket auth error')
      // Error logged but message not in response body
      expect(errors.some(e => e.includes('internal db hiccup'))).toBe(true)
    }
    finally {
      console.error = orig
    }
  })

  test('getWsAuthenticator round-trips with setWsAuthenticator', () => {
    expect(getWsAuthenticator()).toBeNull()
    const fn = () => ({ ok: true as const })
    setWsAuthenticator(fn)
    expect(getWsAuthenticator()).toBe(fn)
  })
})
