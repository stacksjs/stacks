import type { Broadcastable, BroadcastConfig } from '@stacksjs/types'
import { log } from '@stacksjs/cli'
import { realtime } from '@stacksjs/realtime'

export async function runBroadcast(name: string, data?: any): Promise<void> {
  const broadcastModule = await import(`../../../Broadcasts/${name}.ts`)
  const broadcast = broadcastModule.default as BroadcastConfig

  const channel = broadcast.channel || 'default'
  const event = broadcast.event || name

  if (broadcast.handle) {
    // If handle is defined, execute it before broadcasting
    await broadcast.handle(data)
  }

  await realtime.broadcast(channel, event, data)
}

export class Broadcast implements Broadcastable {
  protected options: BroadcastConfig = {}
  protected channelType: 'public' | 'private' | 'presence' = 'public'
  protected excludeCurrentUser = false

  constructor(
    protected name: string,
    protected data?: any,
  ) {}

  async broadcast(): Promise<void> {
    try {
      if (!realtime.isConnected()) {
        await realtime.connect()
      }

      const channel = this.options.channel || 'default'
      const event = this.name

      // Handle excluding current user if toOthers() was called
      if (this.excludeCurrentUser) {
        // Add logic to exclude current user based on your authentication system
        // This is typically done by adding a socket ID or user ID to the data
      }

      await realtime.broadcast(channel, event, this.data, this.channelType)
    }
    catch (error) {
      log.error(`Failed to broadcast event ${this.name}:`, error)
      throw error
    }
  }

  async broadcastNow(): Promise<void> {
    await this.broadcast()
  }

  onChannel(channel: string): this {
    this.options.channel = channel
    return this
  }

  toOthers(): this {
    this.excludeCurrentUser = true
    return this
  }

  toPresence(): this {
    this.channelType = 'presence'
    return this
  }

  toPrivate(): this {
    this.channelType = 'private'
    return this
  }
}

export class BroadcastFactory {
  static make(name: string, data?: any): Broadcast {
    return new Broadcast(name, data)
  }

  static broadcast(name: string, data?: any): Broadcast {
    const broadcast = new Broadcast(name, data)
    broadcast.broadcast()
    return broadcast
  }

  static async broadcastNow(name: string, data?: any): Promise<void> {
    await new Broadcast(name, data).broadcastNow()
  }
}

export function broadcast(name: string, data?: any): Broadcast {
  return BroadcastFactory.make(name, data)
}

// Example broadcast file structures:
/*
// 1. Using handle method
export default {
  channel: 'orders',
  event: 'OrderShipped',
  async handle(data) {
    // Pre-broadcast logic here
    // You can modify the data before broadcasting
  }
}

// 2. Simple broadcast with just channel and event
export default {
  channel: 'notifications',
  event: 'UserNotified'
}

// Usage examples:
await broadcast('OrderShipped', { orderId: 123 })
  .onChannel('orders')
  .broadcast()

await broadcast('UserNotified')
  .onChannel('notifications')
  .toPrivate()
  .toOthers()
  .broadcast()
*/
