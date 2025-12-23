import type { ChannelType } from 'ts-broadcasting'
import { getServer } from './server-instance'

export interface EmitOptions {
  private?: boolean
  presence?: boolean
  exclude?: string | string[]
  driver?: string
}

/**
 * Emit an event to a channel
 *
 * @example
 * // Simple emit to public channel
 * emit('orders', 'created', { id: 1, total: 99.99 })
 *
 * // Emit to private channel
 * emit('orders.123', 'updated', { status: 'shipped' }, { private: true })
 *
 * // Emit to presence channel
 * emit('chat.room.1', 'message', { text: 'Hello' }, { presence: true })
 *
 * // Exclude specific users
 * emit('chat.room.1', 'message', { text: 'Hello' }, { exclude: 'user-123' })
 */
export function emit<T = unknown>(
  channel: string,
  event: string,
  data?: T,
  options?: EmitOptions,
): void {
  const server = getServer()

  if (!server) {
    console.warn('[realtime] Server not initialized, cannot emit event')
    return
  }

  // Determine channel type and prefix
  let channelName = channel

  if (options?.presence) {
    if (!channel.startsWith('presence-')) {
      channelName = `presence-${channel}`
    }
  }
  else if (options?.private) {
    if (!channel.startsWith('private-')) {
      channelName = `private-${channel}`
    }
  }

  // Get exclude socket ID
  const excludeSocketId = options?.exclude
    ? Array.isArray(options.exclude)
      ? options.exclude[0] // BroadcastServer only supports single socket exclusion
      : options.exclude
    : undefined

  // Broadcast the event
  server.broadcast(channelName, event, data, excludeSocketId)
}

/**
 * Emit an event to a specific user
 *
 * @example
 * emitToUser('user-123', 'notification', { message: 'You have a new order!' })
 */
export function emitToUser<T = unknown>(
  userId: string | number,
  event: string,
  data?: T,
  options?: Omit<EmitOptions, 'private'>,
): void {
  emit(`private-user.${userId}`, event, data, { ...options, private: true })
}

/**
 * Emit an event to multiple users
 *
 * @example
 * emitToUsers(['user-1', 'user-2'], 'announcement', { message: 'Server maintenance!' })
 */
export function emitToUsers<T = unknown>(
  userIds: (string | number)[],
  event: string,
  data?: T,
  options?: Omit<EmitOptions, 'private'>,
): void {
  for (const userId of userIds) {
    emitToUser(userId, event, data, options)
  }
}
