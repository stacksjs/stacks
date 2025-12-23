import type { ChannelType } from 'ts-broadcasting'
import { getServer } from './server-instance'

/**
 * Stacks Channel class for backward compatibility
 * Provides a fluent API for broadcasting to channels
 */
export class Channel {
  private channelName: string

  constructor(channel: string) {
    this.channelName = channel
  }

  /**
   * Broadcast to a private channel
   */
  async private(event: string, data?: any): Promise<void> {
    const server = getServer()
    if (!server) {
      throw new Error('Broadcast server not initialized')
    }

    const fullChannelName = this.channelName.startsWith('private-')
      ? this.channelName
      : `private-${this.channelName}`

    server.broadcast(fullChannelName, event, data)
  }

  /**
   * Broadcast to a public channel
   */
  async public(event: string, data?: any): Promise<void> {
    const server = getServer()
    if (!server) {
      throw new Error('Broadcast server not initialized')
    }

    server.broadcast(this.channelName, event, data)
  }

  /**
   * Broadcast to a presence channel
   */
  async presence(event: string, data?: any): Promise<void> {
    const server = getServer()
    if (!server) {
      throw new Error('Broadcast server not initialized')
    }

    const fullChannelName = this.channelName.startsWith('presence-')
      ? this.channelName
      : `presence-${this.channelName}`

    server.broadcast(fullChannelName, event, data)
  }

  /**
   * Broadcast to a channel with explicit type
   */
  async broadcast(event: string, data?: any, type: ChannelType = 'public'): Promise<void> {
    switch (type) {
      case 'private':
        return this.private(event, data)
      case 'presence':
        return this.presence(event, data)
      default:
        return this.public(event, data)
    }
  }
}

/**
 * Create a new channel instance
 *
 * @example
 * // Broadcast to a public channel
 * await channel('orders').public('created', { id: 1 })
 *
 * // Broadcast to a private channel
 * await channel('orders.123').private('updated', { status: 'shipped' })
 *
 * // Broadcast to a presence channel
 * await channel('chat.room.1').presence('message', { text: 'Hello' })
 */
export function channel(name: string): Channel {
  return new Channel(name)
}
