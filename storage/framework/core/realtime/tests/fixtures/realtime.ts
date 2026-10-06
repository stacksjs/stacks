/**
 * Shared helpers for the realtime tests: a random port for a started server,
 * a WebSocket subscriber against it, and an unstarted BroadcastServer whose
 * `broadcast()` calls are recorded.
 */

import { spyOn } from 'bun:test'
import { BroadcastServer } from 'ts-broadcasting'

/**
 * ts-broadcasting falls back to 6001 for a missing port, so a test picks a
 * random high one rather than relying on 0.
 */
export function randomPort(): number {
  return 46_000 + Math.floor(Math.random() * 10_000)
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
