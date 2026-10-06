/**
 * `broadcast()` from `@stacksjs/realtime` reaches a subscriber.
 *
 * The package re-exports ts-broadcasting, so `broadcast()`, `broadcastToUser()`
 * and `Broadcast.send()` are ts-broadcasting's, and they read the server from
 * ts-broadcasting's own `Broadcast.setServer()`. Stacks' `createServer()` /
 * `setServer()` never called it, so against a running server every one of
 * them threw "Broadcast server not initialized" - and the ORM, which sends
 * model events through `broadcast()`, logged that and dropped every event.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Broadcast, broadcast, createServer, getServer, stopServer } from '../src'

// ts-broadcasting reads `port || 6001`, so 0 cannot ask for a free port.
const port = 46_000 + Math.floor(Math.random() * 10_000)

beforeAll(async () => {
  await createServer({ host: '127.0.0.1', port } as never)
})

afterAll(async () => {
  await stopServer()
})

function subscriber(channel: string): Promise<{ socket: WebSocket, next: () => Promise<any> }> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`)
    const inbox: any[] = []
    const waiting: Array<(message: any) => void> = []
    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data))
      const waiter = waiting.shift()
      if (waiter)
        waiter(message)
      else
        inbox.push(message)
    }
    const next = (): Promise<any> => inbox.length > 0
      ? Promise.resolve(inbox.shift())
      : new Promise(r => waiting.push(r))
    socket.onerror = reject
    socket.onopen = async () => {
      socket.send(JSON.stringify({ event: 'subscribe', channel }))
      // Wait until the server has registered the subscription.
      while (true) {
        const message = await next()
        if (String(message.event).includes('subscription_succeeded'))
          break
      }
      resolve({ socket, next })
    }
  })
}

describe('the broadcast facade', () => {
  test('uses the server createServer() started', () => {
    expect(Broadcast.getServer()).toBe(getServer())
  })

  test('broadcast(channel, event, data) is delivered to a subscriber', async () => {
    const { socket, next } = await subscriber('orders')
    try {
      broadcast('orders', 'created', { id: 7 })
      const message = await next()
      expect(message).toMatchObject({ event: 'created', channel: 'orders', data: { id: 7 } })
    }
    finally {
      socket.close()
    }
  })

  test('stopping the server clears the facade too', async () => {
    const { stopServer: stop, createServer: start } = await import('../src')
    await stop()
    expect(Broadcast.getServer()).toBeNull()
    await start({ host: '127.0.0.1', port } as never)
    expect(Broadcast.getServer()).toBe(getServer())
  })
})
