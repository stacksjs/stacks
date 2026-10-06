import type { WsAuthenticator } from '../src/ws'
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { Broadcast } from 'ts-broadcasting'
import { createServer, stopServer } from '../src/server-instance'
import { getWsAuthenticator, setWsAuthenticator } from '../src/ws'
import { randomPort, settle, subscriber } from './fixtures/realtime'

// stacksjs/stacks#1877 R-1 - the authenticator installed with
// `setWsAuthenticator()` gates the WebSocket endpoint Stacks actually
// serves: the broadcast server `createServer()` starts.
//
// It used to be consulted only by `handleWebSocketRequest()`, which nothing
// called, while that server upgraded every request it got. These tests run
// against the started server.

const port = randomPort()
let appHook: ((req: Request, user: unknown) => unknown) | null = null

beforeAll(async () => {
  await createServer({
    host: '127.0.0.1',
    port,
    // An app's own authorizer runs after Stacks' authenticator.
    authorizeConnection: (req, user) => (appHook ? appHook(req, user) : true) as never,
  })
})

afterAll(async () => {
  await stopServer()
})

afterEach(() => {
  setWsAuthenticator(null)
  appHook = null
})

/**
 * A plain GET on the upgrade path: a refusal answers with its own status;
 * an accepted request reaches `server.upgrade()`, which a non-WebSocket
 * request fails with a 400.
 */
async function upgrade(query = '', path = '/ws'): Promise<{ status: number, body: string }> {
  const response = await fetch(`http://127.0.0.1:${port}${path}${query}`)
  return { status: response.status, body: await response.text() }
}

describe('setWsAuthenticator() on the broadcast server', () => {
  test('without an authenticator, upgrades proceed', async () => {
    expect((await upgrade()).status).toBe(400)
    const sub = await subscriber(port, 'news')
    sub.socket.close()
  })

  test('an authenticator installed after the server started refuses the upgrade', async () => {
    setWsAuthenticator(() => ({ ok: false, status: 401, message: 'no token' }))

    expect(await upgrade()).toEqual({ status: 401, body: 'no token' })
    expect(await upgrade('', '/app')).toEqual({ status: 401, body: 'no token' })
    await expect(subscriber(port, 'news')).rejects.toThrow()
  })

  test('a refusal defaults to 401 Unauthorized, and honors a custom status', async () => {
    setWsAuthenticator(() => ({ ok: false }))
    expect(await upgrade()).toEqual({ status: 401, body: 'Unauthorized' })

    setWsAuthenticator(() => ({ ok: false, status: 403, message: 'Forbidden' }))
    expect(await upgrade()).toEqual({ status: 403, body: 'Forbidden' })
  })

  test('an async authenticator is awaited, per request', async () => {
    setWsAuthenticator(async (req) => {
      await settle(10)
      return new URL(req.url).searchParams.get('token') === 'ok' ? { ok: true } : { ok: false }
    })

    expect((await upgrade('?token=ok')).status).toBe(400)
    expect((await upgrade('?token=bad')).status).toBe(401)
  })

  test('an authenticator that throws refuses with a 500 and does not leak the error', async () => {
    setWsAuthenticator(() => {
      throw new Error('internal db hiccup')
    })

    const orig = console.error
    const errors: string[] = []
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(' '))
    }
    try {
      const refused = await upgrade()
      expect(refused.status).toBe(500)
      expect(refused.body).not.toContain('hiccup')
      expect(errors.some(e => e.includes('internal db hiccup'))).toBe(true)
    }
    finally {
      console.error = orig
    }
  })

  test('the user and data it returns are what channel authorization sees', async () => {
    setWsAuthenticator((req) => {
      const token = new URL(req.url).searchParams.get('token')
      return token === 'alice' ? { ok: true, user: { id: 7, name: 'Alice' }, data: { team: 'red' } } : { ok: false }
    })
    Broadcast.channel('private-team.{team}', (socket, params) => {
      return socket.data.user?.id === 7 && socket.data.data?.team === params?.team
    })

    const sub = await subscriber(port, 'private-team.red', '/ws?token=alice')
    expect(sub.socketId).toBeString()
    sub.socket.close()
  })

  test('the app\'s own authorizeConnection still runs, and receives the authenticated user', async () => {
    const seen: unknown[] = []
    setWsAuthenticator(() => ({ ok: true, user: { id: 9 } }))
    appHook = (_req, user) => {
      seen.push(user)
      return { ok: false, status: 429, message: 'Slow down' }
    }

    expect(await upgrade()).toEqual({ status: 429, body: 'Slow down' })
    expect(seen).toEqual([{ id: 9 }])
  })

  test('getWsAuthenticator round-trips with setWsAuthenticator', () => {
    expect(getWsAuthenticator()).toBeNull()
    const fn: WsAuthenticator = () => ({ ok: true })
    setWsAuthenticator(fn)
    expect(getWsAuthenticator()).toBe(fn)
  })
})
