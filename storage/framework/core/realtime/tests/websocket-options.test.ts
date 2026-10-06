import { Buffer } from 'node:buffer'
import net from 'node:net'
import { afterEach, describe, expect, test } from 'bun:test'
import { createServer, getServer, stopServer } from '../src/server-instance'
import { randomPort } from './fixtures/realtime'

/**
 * Dead sockets and slow consumers are handled by the broadcast server's own
 * Bun WebSocket options, passed through `createServer()`.
 *
 * Stacks used to ship its own heartbeat and backpressure guard instead. Both
 * looked for sockets under `server.channels.get()/.values()`, which on a real
 * BroadcastServer is a ChannelManager of socket IDs, so they never found a
 * socket; and nothing called `markPong()`, so a working heartbeat would have
 * closed every healthy socket. Their tests passed against a hand-built
 * `Map<channel, Set<socket>>` that no server has.
 */

afterEach(async () => {
  await stopServer()
})

/**
 * A raw WebSocket client that subscribes to `channel` and then stops
 * reading: it never drains and never answers a ping.
 */
async function silentClient(port: number, channel: string): Promise<net.Socket> {
  const sock = net.connect(port, '127.0.0.1')
  await new Promise(resolve => sock.once('connect', resolve))
  sock.write('GET /ws HTTP/1.1\r\nHost: 127.0.0.1\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n')
  await new Promise(resolve => sock.once('data', resolve))

  const payload = Buffer.from(JSON.stringify({ event: 'subscribe', channel }))
  const mask = Buffer.from([1, 2, 3, 4])
  const masked = Buffer.from(payload.map((byte, i) => byte ^ mask[i % 4]!))
  sock.write(Buffer.concat([Buffer.from([0x81, 0x80 | payload.length]), mask, masked]))
  await new Promise(resolve => setTimeout(resolve, 100))
  sock.pause()
  return sock
}

async function until(condition: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!condition()) {
    if (Date.now() > deadline)
      throw new Error('condition not met in time')
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}

describe('createServer() websocket options', () => {
  test('idleTimeout reaches the client as activity_timeout', async () => {
    const port = randomPort()
    await createServer({ host: '127.0.0.1', port, websocket: { idleTimeout: 30 } })

    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`)
    const established = await new Promise<any>((resolve) => {
      socket.onmessage = event => resolve(JSON.parse(String(event.data)))
    })
    expect(established.data.activity_timeout).toBe(30)
    socket.close()
  })

  test('closeOnBackpressureLimit drops a consumer that stops reading', async () => {
    const port = randomPort()
    const server = await createServer({
      host: '127.0.0.1',
      port,
      websocket: { backpressureLimit: 64 * 1024, closeOnBackpressureLimit: true },
    })
    const silent = await silentClient(port, 'hot')
    expect(server.getSubscriberCount('hot')).toBe(1)

    const frame = 'x'.repeat(64 * 1024)
    for (let i = 0; i < 400 && server.getConnectionCount() > 0; i++) {
      server.broadcast('hot', 'tick', frame)
      await new Promise(resolve => setTimeout(resolve, 1))
    }

    await until(() => getServer()!.getConnectionCount() === 0, 5000)
    expect(server.getSubscriberCount('hot')).toBe(0)
    silent.destroy()
  }, 15_000)
})
