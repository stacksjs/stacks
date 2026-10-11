import process from 'node:process'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NotificationUnsubscribe } from './email-body'
import { setNotificationPreference } from './preferences'

/**
 * Signed unsubscribe links for notification preferences.
 *
 * `@stacksjs/email` has its own unsubscribe tokens, which suppress an
 * address in `email_suppressions` for good. These are for the softer and
 * more common case: one person turning off one category on one channel
 * (marketing email, say), the same row a settings page writes. The token
 * names the user, channel and category and is signed with `APP_KEY`, so a
 * link can only ever switch off what it was minted for.
 *
 * The format is `base64url("{userId}:{channel}:{category}:{hmac-sha256 hex}")`.
 * It does not expire: an archived marketing email must still be able to
 * unsubscribe, and the worst a leaked link can do is stop marketing.
 */

export type UnsubscribeChannel = 'email' | 'sms'

export interface ParsedUnsubscribeToken {
  userId: number
  channel: UnsubscribeChannel
  category: string
}

const CHANNELS: readonly UnsubscribeChannel[] = ['email', 'sms']

function appKey(): string {
  const key = process.env.APP_KEY
  if ((!key || key.length < 16) && (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production'))
    throw new Error('[notifications/unsubscribe] APP_KEY is missing or too short (need at least 16 characters). Cannot sign unsubscribe links.')
  return key || 'stacks-default-key-dev-only-do-not-use-prod'
}

function sign(payload: string): string {
  return createHmac('sha256', appKey()).update(payload).digest('hex')
}

/** A signed token that turns off `category` on `channel` for `userId`. */
export function notificationUnsubscribeToken(userId: number, channel: UnsubscribeChannel, category = 'marketing'): string {
  if (!Number.isSafeInteger(userId) || userId <= 0)
    throw new Error('An unsubscribe token needs a positive user id')
  if (!CHANNELS.includes(channel))
    throw new Error(`Unsupported unsubscribe channel: ${channel}`)
  if (!category || category.includes(':'))
    throw new Error('An unsubscribe category must be non-empty and contain no colon')
  const payload = `${userId}:${channel}:${category}`
  return Buffer.from(`${payload}:${sign(payload)}`).toString('base64url')
}

/**
 * Verify a token from {@link notificationUnsubscribeToken}. Null when it is
 * malformed, not canonical base64url, for an unsupported channel, or not
 * signed with this app's key. Signatures are compared in constant time.
 */
export function parseNotificationUnsubscribeToken(token: string): ParsedUnsubscribeToken | null {
  try {
    const decoded = Buffer.from(String(token ?? ''), 'base64url').toString('utf8')
    // Reject anything that does not round-trip, so one token has one spelling.
    if (!token || Buffer.from(decoded).toString('base64url') !== token)
      return null
    const parts = decoded.split(':')
    if (parts.length !== 4)
      return null
    const [rawUser, channel, category, supplied] = parts as [string, string, string, string]
    if (!rawUser || !category || !supplied || !CHANNELS.includes(channel as UnsubscribeChannel))
      return null
    const expected = sign(`${rawUser}:${channel}:${category}`)
    if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)))
      return null
    const userId = Number(rawUser)
    return Number.isSafeInteger(userId) && userId > 0 && String(userId) === rawUser
      ? { userId, channel: channel as UnsubscribeChannel, category }
      : null
  }
  catch {
    return null
  }
}

export interface UnsubscribeLinkOptions {
  channel?: UnsubscribeChannel
  category?: string
  /** Defaults to `APP_URL`. */
  baseUrl?: string
  /** The page that asks first. Default `/unsubscribe`. */
  pagePath?: string
  /** The one-click endpoint. Default `/api/notifications/unsubscribe`. */
  endpointPath?: string
  /** Default `/settings`. Pass `false` to leave the link out. */
  preferencesPath?: string | false
  notice?: string
}

/**
 * The `payload.unsubscribe` for one person: the page link (`?token=`), the
 * one-click endpoint (`?token=`, so a mail client's form POST carries it),
 * and the preferences page.
 */
export function notificationUnsubscribeLinks(userId: number, options: UnsubscribeLinkOptions = {}): NotificationUnsubscribe {
  const base = String(options.baseUrl || process.env.APP_URL || 'http://localhost').replace(/\/$/, '')
  const token = notificationUnsubscribeToken(userId, options.channel ?? 'email', options.category ?? 'marketing')
  const path = (value: string): string => value.startsWith('/') ? value : `/${value}`
  return {
    url: `${base}${path(options.pagePath ?? '/unsubscribe')}?token=${token}`,
    oneClickUrl: `${base}${path(options.endpointPath ?? '/api/notifications/unsubscribe')}?token=${token}`,
    ...(options.preferencesPath === false ? {} : { preferencesUrl: `${base}${path(options.preferencesPath ?? '/settings')}` }),
    ...(options.notice ? { notice: options.notice } : {}),
  }
}

/**
 * The token an unsubscribe request carries. A page posts `{ token }` as JSON;
 * a mail client's one-click button POSTs `List-Unsubscribe=One-Click` as a
 * form to the `List-Unsubscribe` URL, so there it is in the query string.
 */
export async function unsubscribeTokenFromRequest(request: { url: string, json?: () => Promise<any> }): Promise<string> {
  const query = new URL(request.url, 'http://localhost').searchParams.get('token')
  if (query)
    return query
  const body = await request.json?.().catch(() => ({}))
  return String(body?.token || '')
}

/**
 * Verify a token and turn its preference off. Returns what was turned off,
 * or null for an invalid token (answer 422).
 */
export async function unsubscribeWithToken(token: string): Promise<ParsedUnsubscribeToken | null> {
  const parsed = parseNotificationUnsubscribeToken(token)
  if (!parsed)
    return null
  await setNotificationPreference(parsed.userId, parsed.channel, false, parsed.category)
  return parsed
}
