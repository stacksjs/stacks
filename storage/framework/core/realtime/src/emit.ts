import type { ChannelType, EmitOptions } from '@stacksjs/types'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { RealtimeFactory } from './factory'

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
  const driverType = options?.driver ?? config.realtime?.driver ?? 'bun'
  const driver = RealtimeFactory.getInstance().getDriver(driverType)

  // Determine channel type
  let channelType: ChannelType = 'public'
  if (options?.presence) {
    channelType = 'presence'
  }
  else if (options?.private) {
    channelType = 'private'
  }

  // Build the payload
  const payload = {
    data,
    exclude: options?.exclude
      ? Array.isArray(options.exclude)
        ? options.exclude
        : [options.exclude]
      : undefined,
  }

  // Broadcast the event
  driver.broadcast(channel, event, payload, channelType)

  log.debug(`[realtime] emit "${event}" to ${channelType}:${channel}`)
}

/**
 * Emit an event to a specific user
 *
 * @example
 * emitToUser('user-123', 'notification', { message: 'You have a new order!' })
 */
export function emitToUser<T = unknown>(
  userId: string,
  event: string,
  data?: T,
  options?: Omit<EmitOptions, 'private'>,
): void {
  emit(`user.${userId}`, event, data, { ...options, private: true })
}

/**
 * Emit an event to multiple users
 *
 * @example
 * emitToUsers(['user-1', 'user-2'], 'announcement', { message: 'Server maintenance!' })
 */
export function emitToUsers<T = unknown>(
  userIds: string[],
  event: string,
  data?: T,
  options?: Omit<EmitOptions, 'private'>,
): void {
  for (const userId of userIds) {
    emitToUser(userId, event, data, options)
  }
}
