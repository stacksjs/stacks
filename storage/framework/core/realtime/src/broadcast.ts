import type { BroadcastEvent, ChannelType } from 'ts-broadcasting'
import { log } from '@stacksjs/logging'
import { getServer } from './server-instance'

export interface BroadcastInstance {
  channel?: () => string | string[]
  broadcastOn?: () => string | string[]
  event?: () => string
  broadcastAs?: () => string
  data?: () => any
  broadcastWith?: () => any
  handle?: (payload?: any) => Promise<void> | void
}

/**
 * Stacks Broadcast class for backward compatibility
 * Wraps ts-broadcasting's BroadcastServer
 */
export class Broadcast {
  /**
   * Connect to the realtime service
   */
  async connect(): Promise<void> {
    // No-op - connection is managed by BroadcastServer
  }

  /**
   * Disconnect from the realtime service
   */
  async disconnect(): Promise<void> {
    // No-op - disconnection is managed by BroadcastServer
  }

  /**
   * Subscribe to a channel
   */
  subscribe(channel: string, callback: (data: any) => void): void {
    // Subscription is client-side, not server-side
    // This is handled by BroadcastClient
    log.warn('Broadcast.subscribe() is a client-side operation. Use BroadcastClient instead.')
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel: string): void {
    // Unsubscription is client-side, not server-side
    log.warn('Broadcast.unsubscribe() is a client-side operation. Use BroadcastClient instead.')
  }

  /**
   * Broadcast an event to a channel
   *
   * Goes through `server.broadcast()` like every other API: the server
   * skips serializing a frame for a channel nobody on it is subscribed
   * to, and the replay buffer records the message (when configured) via
   * the hook `setServer()` installs.
   */
  broadcast(channel: string, event: string, data?: any, type: ChannelType = 'public'): void {
    const server = getServer()

    if (!server) {
      log.warn('Broadcast server not initialized')
      return
    }

    let channelName = channel
    if (type === 'private' && !channel.startsWith('private-')) {
      channelName = `private-${channel}`
    }
    else if (type === 'presence' && !channel.startsWith('presence-')) {
      channelName = `presence-${channel}`
    }

    try {
      server.broadcast(channelName, event, data)
    }
    catch (err) {
      log.error(`[Broadcast] Failed to broadcast event '${event}' to channel '${channelName}':`, err)
    }
  }

  /**
   * Check if connected to the realtime service
   */
  isConnected(): boolean {
    return getServer() !== null
  }
}

/**
 * Run a broadcast from a broadcast file
 *
 * @example
 * await runBroadcast('OrderCreated', { orderId: 123 })
 */
export async function runBroadcast(name: string, payload?: any): Promise<void> {
  // Dynamically import path utilities to avoid build-time issues
  const { appPath } = await import('@stacksjs/path')
  const bun = await import('bun')

  let broadcastFiles: string[]
  try {
    // `Bun.Glob`, which is the scanner Bun's module type declares. `globSync`
    // was reached through a cast, so whether it existed at all was never
    // checked here.
    const glob = new bun.Glob('Broadcasts/**/*.ts')
    broadcastFiles = [...glob.scanSync({ cwd: appPath(), absolute: true })]
  }
  catch (error) {
    throw new Error(`Failed to scan broadcast files: ${error instanceof Error ? error.message : String(error)}`)
  }

  // By name, exactly: `Broadcasts/<name>.ts`, or the one file of that name in
  // a subdirectory. This was `file.endsWith(`${name}.ts`)`, so 'Shipped' ran
  // OrderShipped.ts, and 'Created' ran whichever of OrderCreated.ts and
  // UserCreated.ts the scan listed first.
  const root = appPath('Broadcasts')
  const nameOf = (file: string): string => file.slice(root.length + 1, -'.ts'.length).split('\\').join('/')
  const exact = broadcastFiles.filter(file => nameOf(file) === name)
  const byBasename = name.includes('/') ? [] : broadcastFiles.filter(file => nameOf(file).split('/').pop() === name)
  const candidates = exact.length > 0 ? exact : byBasename

  if (candidates.length > 1)
    throw new Error(`Broadcast ${name} is ambiguous: ${candidates.map(nameOf).join(', ')}. Name it by its path under app/Broadcasts.`)

  const broadcastFile = candidates[0]
  if (!broadcastFile)
    throw new Error(`Broadcast ${name} not found`)

  let broadcastModule: any
  try {
    broadcastModule = await import(broadcastFile)
  }
  catch (error) {
    throw new Error(`Failed to import broadcast '${name}': ${error instanceof Error ? error.message : String(error)}`)
  }

  const instance = broadcastModule.default as BroadcastInstance

  // Handle using handle() method
  if (instance.handle) {
    await instance.handle(payload)
    return
  }

  // Handle using BroadcastEvent-like interface
  const server = getServer()
  if (!server) {
    throw new Error('Broadcast server not initialized')
  }

  const channels = instance.broadcastOn?.() || instance.channel?.() || []
  const eventName = instance.broadcastAs?.() || instance.event?.() || name
  const data = instance.broadcastWith?.() || instance.data?.() || payload

  // Convert to BroadcastEvent and broadcast
  const event: BroadcastEvent = {
    shouldBroadcast: () => true,
    broadcastOn: () => channels,
    broadcastAs: () => eventName,
    broadcastWith: () => data,
  }

  await server.broadcaster.broadcast(event)
}

/**
 * Alias for runBroadcast.
 *
 * @example
 * await broadcast('OrderCreated', { orderId: 123 })
 */
export async function broadcast(name: string, payload?: any): Promise<void> {
  // Validate the event name eagerly — empty / non-string names go through
  // ts-broadcasting and surface as confusing wire-format errors deep
  // inside the channel multiplexer instead of where the bug originated.
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('[realtime] broadcast() requires a non-empty event name')
  }
  await runBroadcast(name, payload)
}
