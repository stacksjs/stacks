/**
 * Shared helpers for the realtime tests: a random port for a started server,
 * a WebSocket subscriber against it, and an unstarted BroadcastServer whose
 * `broadcast()` calls are recorded.
 */

import net from 'node:net'
import { spyOn } from 'bun:test'
import { BroadcastServer } from 'ts-broadcasting'

/**
 * A port the kernel has just said is free.
 *
 * This used to pick at random from a 10,000-wide range and hope. That is a
 * birthday problem rather than bad luck, and it came due: CI failed on
 * `EADDRINUSE` for port 50032 while this suite ran beside the rest of the
 * matrix, in a test about websocket options that has nothing to do with ports.
 *
 * Binding to 0 asks the only authority on what is in use, then hands back the
 * number it assigned. It does not pass 0 through to the server, because
 * ts-broadcasting reads a falsy port as missing and falls back to 6001.
 */
export async function freePort(): Promise<number> {
  const probe = net.createServer()
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => resolve())
  })
  const { port } = probe.address() as net.AddressInfo
  await new Promise<void>(resolve => probe.close(() => resolve()))
  return port
}

export interface Subscriber {
  socket: WebSocket
  socketId: string
  /** Every frame received after subscribing, parsed. */
  inbox: any[]
  /** The next frame, waiting for it if none is queued. */
  next: () => Promise<any>
}

/**
 * Connect to a started server, subscribe to `channel`, and wait until the
 * server confirms the subscription.
 */
export function subscriber(port: number, channel: string, path = '/ws'): Promise<Subscriber> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}${path}`)
    const queue: any[] = []
    const waiting: Array<(message: any) => void> = []
    const inbox: any[] = []
    let socketId = ''
    let subscribed = false

    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data))
      if (subscribed)
        inbox.push(message)
      const waiter = waiting.shift()
      if (waiter)
        waiter(message)
      else
        queue.push(message)
    }
    const next = (): Promise<any> => queue.length > 0
      ? Promise.resolve(queue.shift())
      : new Promise(r => waiting.push(r))

    socket.onerror = () => reject(new Error(`could not connect to ${path} on ${port}`))
    socket.onopen = async () => {
      while (true) {
        const message = await next()
        if (message.event === 'connection_established') {
          socketId = message.data.socket_id
          socket.send(JSON.stringify({ event: 'subscribe', channel }))
        }
        if (message.event === 'subscription_error')
          return reject(new Error(`subscription to ${channel} refused`))
        if (message.event === 'subscription_succeeded')
          break
      }
      subscribed = true
      resolve({ socket, socketId, inbox, next })
    }
  })
}

/** Give in-flight frames a moment to arrive. */
export function settle(ms = 100): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * A real, unstarted BroadcastServer whose `broadcast()` calls are recorded
 * rather than sent, for tests about which channel an API composes.
 */
export function recordingServer(): { server: BroadcastServer, broadcasts: Array<{ channel: string, event: string, data: unknown }> } {
  const server = new BroadcastServer({})
  const broadcasts: Array<{ channel: string, event: string, data: unknown }> = []
  spyOn(server, 'broadcast').mockImplementation((channel: string, event: string, data: unknown) => {
    broadcasts.push({ channel, event, data })
  })
  return { server, broadcasts }
}
