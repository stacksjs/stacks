import { getServer } from './server-instance'

export interface EmitOptions {
  private?: boolean
  presence?: boolean
  /**
   * Socket ID(s) to leave out - the `socket_id` each client receives in
   * `connection_established` (`client.socketId()` in the client SDK),
   * typically sent along with the request that caused the event so its
   * sender does not get its own echo. Not user IDs: a user with two tabs
   * has two sockets. Every ID in an array is excluded.
   */
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
 * // Leave out the sender's socket (its socket ID, from the request)
 * emit('chat.room.1', 'message', { text: 'Hello' }, { exclude: request.header('X-Socket-ID') })
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

  // Broadcast the event, leaving out every excluded socket. This used to
  // pass only the first ID of an array on.
  server.broadcast(channelName, event, data, options?.exclude)
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
