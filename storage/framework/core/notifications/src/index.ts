import { log } from '@stacksjs/cli'
import { notification as _notification } from '@stacksjs/config'
import type { EmailMessage, EmailResult, NotificationOptions } from '@stacksjs/types'
import { mail } from '@stacksjs/email'
import { chat, email, push, sms } from './drivers'
import { BroadcastNotificationDriver } from './drivers/broadcast'
import { DatabaseNotificationDriver } from './drivers/database'
import { filterChannelsByPreferences } from './preferences'

const config = _notification as NotificationOptions | undefined

export type NotificationChannel = 'email' | 'sms' | 'chat' | 'database' | 'push' | 'broadcast'

/** Optional flags accepted by {@link notify}. */
export interface NotifyOptions {
  /**
   * Skip the user-preference filter entirely. Use for transactional
   * notifications that must be delivered regardless of opt-out (password
   * resets, security alerts, billing failures). Default: `false`.
   */
  ignorePreferences?: boolean
  /**
   * Optional preference category — passed to the preferences lookup so
   * users can opt out of, e.g., `marketing` while staying opted in to
   * `system`. Ignored when `ignorePreferences` is true.
   */
  category?: string
}

/** Minimal transport contract used by `notify()` — anything that exposes a
 *  `send(EmailMessage)` returning an `EmailResult` works (the @stacksjs/email
 *  Mail singleton, a per-test LogEmailDriver, a custom mock, etc.). */
export interface EmailTransport {
  send: (message: EmailMessage) => Promise<EmailResult>
}

export interface NotificationPayload {
  subject?: string
  body: string
  data?: Record<string, unknown>
}

export interface NotificationRecipient {
  email?: string
  phone?: string
  userId?: number
  /**
   * Device token(s) for the push channel — Expo tokens
   * (`ExponentPushToken[...]`) or raw FCM registration IDs. A single
   * recipient can have multiple tokens registered (one per device); pass
   * an array and the push driver fans out (multicast on FCM, batch
   * receipts on Expo). Required when `'push'` is in the channel list,
   * same way `email` / `phone` are required for their channels.
   */
  pushTokens?: string | string[]
  /**
   * WebSocket channel name for the `broadcast` notification channel
   * (stacksjs/stacks#669). When omitted, the driver derives a default:
   * `private-user-{userId}` if `userId` is set, otherwise the public
   * `notifications` channel.
   */
  broadcastChannel?: string
}

export interface NotifyResult {
  channel: NotificationChannel
  success: boolean
  error?: Error
}

export function useChat(driver?: string): typeof chat[keyof typeof chat] {
  const resolvedDriver = driver || 'slack'
  return chat[resolvedDriver as keyof typeof chat]
}

/**
 * Return the email transport — by default the @stacksjs/email Mail
 * singleton, which lazy-resolves its driver from `config.email.default`
 * (so `MAIL_MAILER=log` in dev / `ses` in prod just works). Pass an
 * explicit driver name to scope to a specific transport — useful in
 * tests that want to assert against `LogEmailDriver` specifically without
 * touching the global config.
 *
 * Earlier this function returned the *driver namespace* (e.g.
 * `{ SESDriver, default }`), which has no `send`. The `'send' in driver`
 * guard in `notify()` was always false, so the email channel silently
 * no-op'd for every booking confirmation, host alert, etc.
 */
export function useEmail(driver?: string): EmailTransport {
  if (driver) {
    try {
      return mail.use(driver) as unknown as EmailTransport
    }
    catch (err) {
      log.warn(`[notifications] email driver '${driver}' not registered — falling back to default mail singleton (${(err as Error).message})`)
    }
  }
  return mail as unknown as EmailTransport
}

export function useSMS(driver?: string): typeof sms[keyof typeof sms] {
  const resolvedDriver = driver || 'twilio'
  return sms[resolvedDriver as keyof typeof sms]
}

/**
 * Push transport — returns the `@stacksjs/push` namespace whose
 * `send(to, notification, options)` dispatches to Expo or FCM based on
 * `options.driver`. `notify()` calls it with the driver omitted so the
 * push package's own default kicks in (`expo`). Apps that need to
 * force FCM can call `push.send(...)` directly with `{ driver: 'fcm' }`.
 *
 * Previously the `'push'` switch arm in `notify()` threw a hardcoded
 * "not yet wired into a default driver" error even though both drivers
 * exist (stacksjs/stacks#1874 F-1) — this helper is the missing link.
 */
export function usePush(): typeof push {
  return push
}

export function useDatabase(): typeof DatabaseNotificationDriver {
  return DatabaseNotificationDriver
}

/**
 * Broadcast transport — returns the `BroadcastNotificationDriver` which
 * fans out a notification payload over the realtime WebSocket layer
 * (`@stacksjs/realtime` `emit()`). See {@link BroadcastNotificationDriver}
 * for channel-naming rules. stacksjs/stacks#669.
 */
export function useBroadcast(): typeof BroadcastNotificationDriver {
  return BroadcastNotificationDriver
}

export function useNotification(typeParam?: string, driverParam?: string): typeof chat[keyof typeof chat] | typeof email[keyof typeof email] | typeof sms[keyof typeof sms] | typeof DatabaseNotificationDriver {
  const type = typeParam || config?.default || 'email'
  const driver = driverParam

  switch (type) {
    case 'email':
      return useEmail(driver)
    case 'chat':
      return useChat(driver)
    case 'sms':
      return useSMS(driver)
    case 'database':
      return useDatabase()
    default:
      throw new Error(`Notification type "${type}" is not supported`)
  }
}

/**
 * Send a notification through multiple channels simultaneously.
 * Uses Promise.allSettled so one channel failure doesn't block others.
 *
 * When `recipient.userId` is set and `options.ignorePreferences` is not
 * `true`, the channel list is first filtered through the user's
 * `notification_preferences` rows — any channel they've explicitly
 * disabled is silently skipped. Channels with no preference recorded fall
 * through as enabled (default-allow), so introducing this feature doesn't
 * regress notifications for users who haven't visited the preferences UI.
 *
 * For transactional notifications that must always go out (password
 * resets, security alerts, billing failures), pass
 * `{ ignorePreferences: true }`.
 *
 * @example
 * ```ts
 * // respects user preferences
 * await notify({ userId: 7, email: 'a@x' }, { body: 'New message' }, ['email', 'sms'])
 *
 * // bypasses preferences (security alert)
 * await notify({ userId: 7, email: 'a@x' }, { body: 'New login' }, ['email'], { ignorePreferences: true })
 *
 * // category-specific opt-out
 * await notify({ userId: 7, email: 'a@x' }, { body: 'Sale!' }, ['email'], { category: 'marketing' })
 * ```
 */
/** A driver that can deliver a message (sms/chat transports). */
interface SendableDriver {
  send: (message: Record<string, unknown>) => Promise<unknown>
}

/**
 * Whether a resolved driver can actually deliver (stacksjs/stacks#1936).
 * The sms/chat channels previously guarded on this but then silently
 * `break`'d when it was false — recording a success for an
 * undeliverable channel. Now the channel throws on a falsy result.
 */
function isSendableDriver(driver: unknown): driver is SendableDriver {
  return !!driver
    && typeof driver === 'object'
    && 'send' in driver
    && typeof (driver as { send?: unknown }).send === 'function'
}

export async function notify(
  recipient: NotificationRecipient,
  payload: NotificationPayload,
  channels: NotificationChannel[] = ['email'],
  options: NotifyOptions = {},
): Promise<NotifyResult[]> {
  // Filter channels by user preferences when we have a userId to look up.
  // Default-allow: channels with no preference row recorded pass through.
  let effectiveChannels = channels
  if (recipient.userId && !options.ignorePreferences) {
    try {
      effectiveChannels = await filterChannelsByPreferences(
        recipient.userId,
        channels,
        options.category,
      )
    }
    catch (err) {
      // Don't let a preferences DB hiccup take down the notification
      // pipeline — fall back to the unfiltered list and log.
      log.warn(`[notify] preferences filter failed, sending all channels: ${(err as Error).message}`)
    }
  }

  const results = await Promise.allSettled(
    effectiveChannels.map(async (channel) => {
      switch (channel) {
        case 'email': {
          // Fail loudly when the recipient is missing the channel-specific
          // contact — silently no-op'ing meant a forgotten `email` field
          // looked like a successful notification dispatch.
          if (!recipient.email) {
            throw new Error('[notify] email channel requires recipient.email')
          }
          const driver = useEmail()
          // payload.body is plain text — wrap as text and a minimal HTML
          // body so SES/SendGrid drivers (which only render `html`/`text`)
          // actually carry the message. Previously `body` was dropped on
          // the floor by every driver.
          await driver.send({
            to: recipient.email,
            subject: payload.subject,
            text: payload.body,
            html: `<p>${escapeBodyHtml(payload.body)}</p>`,
          })
          break
        }
        case 'sms': {
          // Fail loudly, not silently (stacksjs/stacks#1936). Previously
          // a misconfigured SMS driver (one without a `send()`) let the
          // case fall through and `Promise.allSettled` recorded success —
          // so a broken SMS config looked like a delivered notification.
          if (!recipient.phone) {
            throw new Error('[notify] sms channel requires recipient.phone')
          }
          const driver = useSMS()
          if (!isSendableDriver(driver)) {
            throw new Error('[notify] sms channel is not configured: no usable SMS driver with a send() method')
          }
          await driver.send({ to: recipient.phone, body: payload.body })
          break
        }
        case 'chat': {
          const driver = useChat()
          if (!isSendableDriver(driver)) {
            throw new Error('[notify] chat channel is not configured: no usable chat driver with a send() method')
          }
          await driver.send({ body: payload.body })
          break
        }
        case 'database': {
          if (!recipient.userId) {
            throw new Error('[notify] database channel requires recipient.userId')
          }
          await DatabaseNotificationDriver.send({
            userId: recipient.userId,
            type: payload.subject || 'notification',
            data: { body: payload.body, ...payload.data },
          })
          break
        }
        case 'push': {
          // Wired up in stacksjs/stacks#1874 F-1. Push tokens are the
          // channel-specific contact (analogous to `recipient.email` for
          // email and `recipient.phone` for SMS) — fail loudly when
          // they're missing rather than silently dropping the dispatch.
          if (!recipient.pushTokens || (Array.isArray(recipient.pushTokens) && recipient.pushTokens.length === 0)) {
            throw new Error('[notify] push channel requires recipient.pushTokens')
          }
          const driver = usePush()
          await driver.send(recipient.pushTokens, {
            title: payload.subject,
            body: payload.body,
            data: payload.data,
          })
          break
        }
        case 'broadcast': {
          // Realtime WS fanout (stacksjs/stacks#669). Best-effort:
          // missing realtime server returns `delivered: false` rather
          // than throwing, so a broadcast misconfig doesn't break the
          // rest of the multi-channel dispatch.
          await BroadcastNotificationDriver.send({
            channel: recipient.broadcastChannel,
            userId: recipient.userId,
            event: payload.subject ?? 'notification',
            data: { body: payload.body, ...payload.data },
          })
          break
        }
        default:
          throw new Error(`Unsupported notification channel: ${channel}`)
      }
    }),
  )

  return results.map((result, index) => {
    const channel = effectiveChannels[index]
    if (result.status === 'rejected') {
      // Surface channel failures in the log even when the caller doesn't
      // inspect the returned NotifyResult[] — silently failing fan-out
      // notifications used to mask broken SMS/Slack/email config for days.
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason)
      log.warn(`[notify] ${channel} channel failed: ${reason}`)
    }
    return {
      channel,
      success: result.status === 'fulfilled',
      error: result.status === 'rejected' ? result.reason : undefined,
    }
  })
}

export function notification(): ReturnType<typeof useNotification> {
  return useNotification()
}

export { BroadcastNotificationDriver } from './drivers/broadcast'
export type { BroadcastNotificationOptions, BroadcastNotificationResult } from './drivers/broadcast'
export { DatabaseNotificationDriver } from './drivers/database'
export type { CreateNotificationOptions, DatabaseNotification } from './drivers/database'
export {
  bulkSetPreferences,
  filterChannelsByPreferences,
  getNotificationPreferences,
  setNotificationPreference,
} from './preferences'
export type { NotificationPreferenceRow, PreferenceChannel } from './preferences'

function escapeBodyHtml(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c] as string))
}
