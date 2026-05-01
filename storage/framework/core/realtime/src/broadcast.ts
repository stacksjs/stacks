import type { BroadcastEvent, ChannelType } from 'ts-broadcasting'
import { log } from '@stacksjs/logging'
import { getServer } from './server-instance'

/**
 * Best-effort check for whether anyone is subscribed to `channelName`.
 *
 * The `BroadcastServer` interface is stable but the subscriber-count
 * accessor isn't — different ts-broadcasting versions expose it as
 * `hasSubscribers`, `channelCount`, or via `clients.get(name)?.size`.
 * We try the public surface first and fall back to a permissive
 * `true` so we never *block* a legitimate broadcast just because we
 * couldn't introspect the subscriber set. This stays a perf hint, not
 * a correctness gate.
 */
function hasSubscribers(server: any, channelName: string): boolean {
  try {
    if (typeof server.hasSubscribers === 'function') {
      return Boolean(server.hasSubscribers(channelName))
    }
    if (typeof server.subscriberCount === 'function') {
      return server.subscriberCount(channelName) > 0
    }
    const channels = server.channels ?? server.clients
    if (channels && typeof channels.get === 'function') {
      const set = channels.get(channelName)
      const size = (set && (set.size ?? set.length)) ?? null
      if (typeof size === 'number') return size > 0
    }
  }
  catch {
    // Fall through — if introspection threw, treat as "subscribers might exist".
  }
  return true
}

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
   * Skips the wire-level broadcast when no subscribers are listening on
   * the resolved channel. Without this, every emit walked the channel
   * multiplexer, serialized the payload, and looped through an empty
   * subscriber set — which is wasted work that compounds when chatty
   * model-event broadcasts run on cold sockets.
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

    if (!hasSubscribers(server, channelName)) {
      log.debug(`[Broadcast] Skipping '${event}' on '${channelName}' — no subscribers`)
      return
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
    broadcastFiles = (bun as any).globSync([appPath('Broadcasts/**/*.ts')], { absolute: true })
  }
  catch (error) {
    throw new Error(`Failed to scan broadcast files: ${error instanceof Error ? error.message : String(error)}`)
  }

  const broadcastFile = broadcastFiles.find((file: string) => file.endsWith(`${name}.ts`))

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
