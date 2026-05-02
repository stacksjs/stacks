import type { ChannelType } from 'ts-broadcasting'
import { getServer } from './server-instance'

/**
 * Strip any well-known channel-type prefix from `name` so the
 * type-specific methods can apply their own prefix without the user
 * accidentally producing `private-presence-foo` etc. when the name
 * was passed in already prefixed (or with the wrong prefix).
 *
 * The previous implementation only guarded against the *matching*
 * prefix being doubled — `channel('presence-x').private(...)` would
 * incorrectly emit on `private-presence-x` instead of `private-x`.
 */
const KNOWN_CHANNEL_PREFIXES = ['private-', 'presence-'] as const

function stripPrefix(name: string): string {
  for (const p of KNOWN_CHANNEL_PREFIXES) {
    if (name.startsWith(p)) return name.slice(p.length)
  }
  return name
}

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

    await server.broadcast(`private-${stripPrefix(this.channelName)}`, event, data)
  }

  /**
   * Broadcast to a public channel
   */
  async public(event: string, data?: any): Promise<void> {
    const server = getServer()
    if (!server) {
      throw new Error('Broadcast server not initialized')
    }

    // Public channels never use a prefix. If the caller passed in a
    // type-prefixed name by mistake, strip it so the broadcast actually
    // lands on the public bus rather than colliding with a private one.
    await server.broadcast(stripPrefix(this.channelName), event, data)
  }

  /**
   * Broadcast to a presence channel
   */
  async presence(event: string, data?: any): Promise<void> {
    const server = getServer()
    if (!server) {
      throw new Error('Broadcast server not initialized')
    }

    await server.broadcast(`presence-${stripPrefix(this.channelName)}`, event, data)
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
