import type { PushResult } from '@stacksjs/types'
import { log } from '@stacksjs/cli'
import { appServices, present } from '../app-config'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

/**
 * Expo's per-request limits. Past them it refuses the whole request with a
 * 400, so a send to 101 devices reached none of them:
 *   messages  "\"$\": Must contain at most 100 element(s)."
 *   receipts  PUSH_TOO_MANY_RECEIPTS "... maximum of 1000 receipts per request"
 */
const MAX_MESSAGES_PER_REQUEST = 100
const MAX_RECEIPTS_PER_REQUEST = 1000

export interface ExpoConfig {
  /**
   * An Expo access token, required once "enhanced push security" is turned on
   * for the project: Expo then rejects every send and receipt request that
   * does not carry it.
   */
  accessToken?: string
}

let config: ExpoConfig = {}

/**
 * Configure the Expo driver. Optional: without it the token comes from
 * `config/services.ts` (`EXPO_ACCESS_TOKEN`), and anything set here wins.
 */
export function configure(options: ExpoConfig): void {
  config = { ...config, ...options }
}

/** Forget what `configure()` set. */
export function resetConfiguration(): void {
  config = {}
}

/**
 * The access token a request carries, if any: `configure()`, then the app's
 * `config/services.ts`.
 *
 * `services.expo.accessToken` was declared, typed and read by nothing, so a
 * project with enhanced push security had every push rejected however it was
 * configured (stacksjs/stacks#2857). Read per call, after the app's config
 * has loaded.
 */
export async function resolveAccessToken(): Promise<string | undefined> {
  if (present(config.accessToken))
    return present(config.accessToken)

  try {
    return present((await appServices()).expo?.accessToken)
  }
  catch (error) {
    log.debug(`Expo: could not read config/services.ts: ${error instanceof Error ? error.message : String(error)}`)
    return undefined
  }
}

/** The headers every Expo API request sends. */
async function requestHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...extra,
  }
  const token = await resolveAccessToken()
  if (token)
    headers.Authorization = `Bearer ${token}`
  return headers
}

export interface ExpoPushMessage {
  to: string | string[]
  title?: string
  body: string
  data?: Record<string, any>
  sound?: 'default' | null
  badge?: number
  channelId?: string
  priority?: 'default' | 'normal' | 'high'
  ttl?: number
}

export interface ExpoPushTicket {
  id?: string
  status: 'ok' | 'error'
  message?: string
  details?: {
    error?: 'DeviceNotRegistered' | 'MessageTooBig' | 'MessageRateExceeded' | 'InvalidCredentials'
  }
}

export interface ExpoPushReceipt {
  status: 'ok' | 'error'
  message?: string
  details?: {
    error?: string
  }
}

/**
 * Validates an Expo push token
 */
export function isExpoPushToken(token: string): boolean {
  return /^Expo(?:nent)?PushToken\[.+\]$/.test(token) || /^[a-zA-Z0-9-_]+$/.test(token)
}

/**
 * Send a push notification via Expo Push Service.
 *
 * In requests of at most 100 messages, one after another. `data.tickets` has
 * one ticket per token in `to`, in the same order, an invalid token included
 * as an error, so a caller can match each ticket to its token.
 */
export async function send(message: ExpoPushMessage): Promise<PushResult> {
  const messages = Array.isArray(message.to) ? message.to : [message.to]

  // Validate tokens
  const invalidTokens = messages.filter(token => !isExpoPushToken(token))
  if (invalidTokens.length > 0) {
    log.warn(`Invalid Expo push tokens found: ${invalidTokens.join(', ')}`)
  }

  const validTokens = messages.filter(isExpoPushToken)
  if (validTokens.length === 0) {
    return {
      success: false,
      provider: 'expo',
      message: 'No valid Expo push tokens provided',
    }
  }

  try {
    const payload = validTokens.map(token => ({
      to: token,
      title: message.title,
      body: message.body,
      data: message.data,
      sound: message.sound ?? 'default',
      badge: message.badge,
      channelId: message.channelId,
      priority: message.priority ?? 'high',
      ttl: message.ttl,
    }))

    // Expo enforces a 4 KiB per-message payload limit. Anything past that
    // is rejected by the receiving devices (or silently dropped). Validate
    // up front so the caller gets a clear error rather than a confusing
    // 200-OK-but-no-delivery experience. Per-message check, not whole-batch.
    const EXPO_PER_MESSAGE_LIMIT = 4096
    for (const msg of payload) {
      const size = new TextEncoder().encode(JSON.stringify(msg)).length
      if (size > EXPO_PER_MESSAGE_LIMIT) {
        return {
          success: false,
          provider: 'expo',
          message: `Expo message payload (${size} bytes) exceeds 4 KiB per-message limit`,
        }
      }
    }

    const headers = await requestHeaders({ 'Accept-Encoding': 'gzip, deflate' })
    const sent: ExpoPushTicket[] = []
    let firstFailure: string | undefined
    for (let start = 0; start < payload.length; start += MAX_MESSAGES_PER_REQUEST) {
      const chunk = payload.slice(start, start + MAX_MESSAGES_PER_REQUEST)
      const response = await fetch(EXPO_PUSH_URL, { method: 'POST', headers, body: JSON.stringify(chunk) })

      if (!response.ok) {
        // This request's messages failed; the others still go. One refused
        // chunk used to be the whole send.
        const failure = `HTTP ${response.status}: ${await response.text()}`
        log.error(`Expo push failed: ${failure}`)
        firstFailure ??= failure
        sent.push(...chunk.map((): ExpoPushTicket => ({ status: 'error', message: failure })))
        continue
      }

      const result = await response.json() as { data: ExpoPushTicket[] }
      sent.push(...result.data)
    }

    // One ticket per token in `to`, in order.
    let next = 0
    const tickets = messages.map((token): ExpoPushTicket => isExpoPushToken(token)
      ? sent[next++] ?? { status: 'error', message: 'Expo returned no ticket for this token' }
      : { status: 'error', message: `"${token}" is not an Expo push token` })

    // Check for errors in tickets
    const errors = tickets.filter(t => t.status === 'error')
    if (errors.length > 0) {
      log.warn(`Some push notifications failed: ${JSON.stringify(errors)}`)
    }

    const successCount = tickets.filter(t => t.status === 'ok').length

    log.info(`Expo push sent: ${successCount}/${tickets.length} successful`)

    return {
      success: errors.length === 0,
      provider: 'expo',
      message: successCount === 0 && firstFailure ? firstFailure : `Sent ${successCount}/${tickets.length} notifications`,
      messageId: tickets.find(t => t.id)?.id,
      data: { tickets },
    }
  }
  catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    log.error(`Expo push error: ${err.message}`)
    return {
      success: false,
      provider: 'expo',
      message: err.message,
    }
  }
}

/**
 * Get push notification receipts from Expo, 1000 IDs per request.
 */
export async function getReceipts(ticketIds: string[]): Promise<Record<string, ExpoPushReceipt>> {
  const headers = await requestHeaders()
  const receipts: Record<string, ExpoPushReceipt> = {}

  for (let start = 0; start < ticketIds.length; start += MAX_RECEIPTS_PER_REQUEST) {
    const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ids: ticketIds.slice(start, start + MAX_RECEIPTS_PER_REQUEST) }),
    })

    if (!response.ok) {
      throw new Error(`Failed to get receipts: ${response.status}`)
    }

    const result = await response.json() as { data: Record<string, ExpoPushReceipt> }
    Object.assign(receipts, result.data)
  }

  return receipts
}

/**
 * Send several messages, `chunkSize` of them at a time. Each message's own
 * tokens go out in requests of at most 100, which `send` does.
 */
export async function sendBatch(messages: ExpoPushMessage[], chunkSize = 100): Promise<PushResult[]> {
  const results: PushResult[] = []

  for (let i = 0; i < messages.length; i += chunkSize) {
    const chunk = messages.slice(i, i + chunkSize)
    const chunkResults = await Promise.all(chunk.map(msg => send(msg)))
    results.push(...chunkResults)
  }

  return results
}

export { send as Send }
export default { send, sendBatch, getReceipts, isExpoPushToken, configure }
