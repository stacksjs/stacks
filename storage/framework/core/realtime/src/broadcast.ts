import type { BroadcastEvent, ChannelType } from 'ts-broadcasting'
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
    console.warn('Broadcast.subscribe() is a client-side operation. Use BroadcastClient instead.')
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel: string): void {
    // Unsubscription is client-side, not server-side
    console.warn('Broadcast.unsubscribe() is a client-side operation. Use BroadcastClient instead.')
  }

  /**
   * Broadcast an event to a channel
   */
  broadcast(channel: string, event: string, data?: any, type: ChannelType = 'public'): void {
    const server = getServer()

    if (!server) {
      console.warn('Broadcast server not initialized')
      return
    }

    let channelName = channel
    if (type === 'private' && !channel.startsWith('private-')) {
      channelName = `private-${channel}`
    }
    else if (type === 'presence' && !channel.startsWith('presence-')) {
      channelName = `presence-${channel}`
    }

    server.broadcast(channelName, event, data)
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
  const { globSync } = await import('bun')

  const broadcastFiles = globSync([appPath('Broadcasts/**/*.ts')], { absolute: true })
  const broadcastFile = broadcastFiles.find((file: string) => file.endsWith(`${name}.ts`))

  if (!broadcastFile)
    throw new Error(`Broadcast ${name} not found`)

  const broadcastModule = await import(broadcastFile)
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
 * Alias for runBroadcast
 *
 * @example
 * await broadcast('OrderCreated', { orderId: 123 })
 */
export async function broadcast(name: string, payload?: any): Promise<void> {
  await runBroadcast(name, payload)
}
