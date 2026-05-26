/**
 * Broadcast notifications driver (stacksjs/stacks#669).
 *
 * Sends notification payloads as real-time events over the framework's
 * WebSocket fanout (`@stacksjs/realtime` `emit()`), so connected clients
 * see the notification immediately without polling. Useful for in-app
 * toasts, badge counts, live activity feeds, etc.
 *
 * The realtime module is lazy-imported so apps that don't use the
 * broadcast channel don't pay the import cost — and missing realtime
 * (e.g., CLI / migration context with no running server) returns
 * `delivered: false` instead of throwing.
 */

import { log } from '@stacksjs/cli'

/** Options accepted by the broadcast driver. */
export interface BroadcastNotificationOptions {
  /**
   * WebSocket channel name. Defaults to `private-user-{userId}` when
   * `userId` is provided, otherwise the public `notifications` channel.
   * Pass an explicit `channel` to scope the broadcast (e.g.,
   * `private-orders-42`, `presence-chat-1`).
   */
  channel?: string
  /**
   * Optional `userId` — used to derive the default `private-user-{id}`
   * channel name when no explicit channel is supplied.
   */
  userId?: number
  /** Event name. Defaults to `'notification'`. */
  event?: string
  /** Free-form payload broadcast to subscribers of the channel. */
  data?: Record<string, unknown>
  /**
   * Treat the derived channel as `private-` if not already prefixed.
   * Default `true` when `userId` is provided, `false` otherwise.
   */
  private?: boolean
}

export interface BroadcastNotificationResult {
  delivered: boolean
  channel: string
  event: string
  reason?: string
}

export const BroadcastNotificationDriver = {
  /**
   * Emit the notification over the realtime channel. Resolves with
   * `delivered: false` (and a reason) when no realtime server is
   * available rather than throwing — fire-and-forget is the right shape
   * for a notification channel that ships transports best-effort.
   */
  async send(options: BroadcastNotificationOptions): Promise<BroadcastNotificationResult> {
    const event = options.event ?? 'notification'
    let channel = options.channel
    if (!channel) {
      channel = options.userId !== undefined
        ? `private-user-${options.userId}`
        : 'notifications'
    }

    try {
      // Lazy-import so CLI / migration contexts that never wire the
      // realtime server don't pay the cost (or throw on missing deps).
      const mod = await import('@stacksjs/realtime').catch(() => null)
      const emit = (mod as { emit?: (channel: string, event: string, data?: unknown, options?: { private?: boolean }) => void } | null)?.emit
      const getServer = (mod as { getServer?: () => unknown } | null)?.getServer
      if (!emit || !getServer) {
        return { delivered: false, channel, event, reason: '@stacksjs/realtime is not available' }
      }

      // `emit()` returns void and silently no-ops when no WS server is
      // running, so a missing server would otherwise look like a
      // successful delivery. Peek at `getServer()` upfront so the
      // result accurately reflects whether the broadcast went out.
      if (!getServer()) {
        return { delivered: false, channel, event, reason: 'realtime server not running' }
      }

      const isPrivate = options.private ?? (options.userId !== undefined)
      emit(channel, event, options.data, { private: isPrivate })
      log.info(`[notifications] broadcast to '${channel}' (${event})`)
      return { delivered: true, channel, event }
    }
    catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      log.warn(`[notifications] broadcast failed: ${reason}`)
      return { delivered: false, channel, event, reason }
    }
  },
}
