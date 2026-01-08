import type { PushMessage, PushResult, PushTicket } from '@stacksjs/types'
import { log } from '@stacksjs/cli'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

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
  return /^Expo(nent)?PushToken\[.+\]$/.test(token) || /^[a-zA-Z0-9-_]+$/.test(token)
}

/**
 * Send a push notification via Expo Push Service
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

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      log.error(`Expo push failed: ${errorText}`)
      return {
        success: false,
        provider: 'expo',
        message: `HTTP ${response.status}: ${errorText}`,
      }
    }

    const result = await response.json() as { data: ExpoPushTicket[] }
    const tickets = result.data

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
      message: `Sent ${successCount}/${tickets.length} notifications`,
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
 * Get push notification receipts from Expo
 */
export async function getReceipts(ticketIds: string[]): Promise<Record<string, ExpoPushReceipt>> {
  const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids: ticketIds }),
  })

  if (!response.ok) {
    throw new Error(`Failed to get receipts: ${response.status}`)
  }

  const result = await response.json() as { data: Record<string, ExpoPushReceipt> }
  return result.data
}

/**
 * Send multiple push notifications in chunks (Expo recommends max 100 per request)
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
export default { send, sendBatch, getReceipts, isExpoPushToken }
