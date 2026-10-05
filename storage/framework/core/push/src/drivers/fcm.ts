import type { PushResult } from '@stacksjs/types'
import { log } from '@stacksjs/cli'

const FCM_V1_URL = 'https://fcm.googleapis.com/v1/projects'

export interface FCMMessage {
  to?: string
  topic?: string
  condition?: string
  notification?: {
    title: string
    body: string
    icon?: string
    image?: string
    sound?: string
    badge?: string
    clickAction?: string
    tag?: string
  }
  data?: Record<string, string>
  priority?: 'high' | 'normal'
  ttl?: number
  collapseKey?: string
}

export interface FCMConfig {
  projectId?: string
  serviceAccount?: {
    clientEmail: string
    privateKey: string
  }
}

let config: FCMConfig = {}

/**
 * Configure FCM with a service account
 */
export function configure(options: FCMConfig): void {
  config = { ...config, ...options }
}

/**
 * base64url, the only encoding a JWS segment may use (RFC 7515 section 2).
 *
 * Plain base64 is not interchangeable: `+`, `/` and the `=` padding all make
 * Google's token endpoint reject the assertion, and roughly two thirds of
 * service account addresses produce at least one of them.
 */
function base64Url(input: string): string {
  return btoa(input)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Build the signed JWT that Google's OAuth2 endpoint accepts as a service
 * account assertion.
 *
 * `nowSeconds` is a parameter rather than a `Date.now()` read so the encoding
 * can be asserted against a fixed claim set.
 */
export async function buildServiceAccountAssertion(
  clientEmail: string,
  privateKey: string,
  nowSeconds: number,
): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  }

  const encoder = new TextEncoder()
  const headerB64 = base64Url(JSON.stringify(header))
  const payloadB64 = base64Url(JSON.stringify(payload))
  const signatureInput = `${headerB64}.${payloadB64}`

  // Import the private key and sign
  const keyData = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')

  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(signatureInput),
  )

  const signatureB64 = base64Url(String.fromCharCode(...new Uint8Array(signature)))

  return `${headerB64}.${payloadB64}.${signatureB64}`
}

/**
 * Get OAuth2 access token for FCM v1 API
 */
async function getAccessToken(): Promise<string> {
  if (!config.serviceAccount) {
    throw new Error('Service account not configured for FCM v1 API')
  }

  const { clientEmail, privateKey } = config.serviceAccount

  const jwt = await buildServiceAccountAssertion(
    clientEmail,
    privateKey,
    Math.floor(Date.now() / 1000),
  )

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  if (!tokenResponse.ok) {
    throw new Error(`Failed to get access token: ${tokenResponse.status}`)
  }

  const tokenData = await tokenResponse.json() as { access_token: string }
  return tokenData.access_token
}

/**
 * Send push notification via FCM v1 API (using service account)
 */
export async function send(message: FCMMessage): Promise<PushResult> {
  // There is deliberately no legacy fallback. The legacy HTTP protocol was
  // decommissioned on 2024-06-20 and its endpoint now answers 404, so falling
  // back to it could only turn a missing credential into a confusing HTTP
  // error further away from the cause.
  if (!config.serviceAccount || !config.projectId) {
    return {
      success: false,
      provider: 'fcm',
      message: 'FCM service account and projectId not configured',
    }
  }

  try {
    const accessToken = await getAccessToken()
    const url = `${FCM_V1_URL}/${config.projectId}/messages:send`

    const fcmMessage: any = {
      message: {
        notification: message.notification,
        data: message.data,
        android: {
          priority: message.priority ?? 'high',
          ttl: message.ttl ? `${message.ttl}s` : undefined,
          collapseKey: message.collapseKey,
        },
        apns: {
          headers: {
            'apns-priority': message.priority === 'high' ? '10' : '5',
          },
        },
      },
    }

    // Set target
    if (message.to) {
      fcmMessage.message.token = message.to
    }
    else if (message.topic) {
      fcmMessage.message.topic = message.topic
    }
    else if (message.condition) {
      fcmMessage.message.condition = message.condition
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fcmMessage),
    })

    if (!response.ok) {
      const errorText = await response.text()
      log.error(`FCM v1 push failed: ${errorText}`)
      return {
        success: false,
        provider: 'fcm',
        message: `HTTP ${response.status}: ${errorText}`,
      }
    }

    const result = await response.json() as { name: string }

    log.info(`FCM v1 push sent: ${result.name}`)

    return {
      success: true,
      provider: 'fcm',
      message: 'Notification sent successfully',
      messageId: result.name,
    }
  }
  catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    log.error(`FCM v1 push error: ${err.message}`)
    return {
      success: false,
      provider: 'fcm',
      message: err.message,
    }
  }
}

/**
 * Send to multiple tokens
 */
export async function sendMulticast(
  tokens: string[],
  message: Omit<FCMMessage, 'to'>,
): Promise<PushResult[]> {
  // The v1 API has no multicast, and the legacy API that did is decommissioned.
  return Promise.all(tokens.map(token => send({ ...message, to: token })))
}

/**
 * Send to a topic
 */
export async function sendToTopic(
  topic: string,
  message: Omit<FCMMessage, 'to' | 'topic'>,
): Promise<PushResult> {
  return send({ ...message, topic })
}

/**
 * Set one registration's membership of a topic through the FCM v1 API.
 *
 * This replaced the Instance ID endpoints `iid/v1:batchAdd` and
 * `iid/v1:batchRemove`, which stop serving requests on 2027-09-29 and are
 * closed to projects that have not already onboarded them from 2027-01-01.
 * The v1 API acts on a single registration, so a batch becomes one request
 * per token (stacksjs/stacks#2856).
 */
async function setTopicSubscription(token: string, topic: string, subscribe: boolean): Promise<boolean> {
  const accessToken = await getAccessToken()
  const base = `${FCM_V1_URL}/${config.projectId}/registrations/${encodeURIComponent(token)}/topicSubscriptions`

  // The topic is a query parameter when subscribing and a path segment when
  // unsubscribing. That asymmetry is the API's, not a transcription slip.
  const url = subscribe
    ? `${base}?topic_name=${encodeURIComponent(topic)}`
    : `${base}/${encodeURIComponent(topic)}`

  const response = await fetch(url, {
    method: subscribe ? 'POST' : 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })

  // 409 on subscribe means the subscription already exists, which is the state
  // the caller asked for.
  if (response.ok || (subscribe && response.status === 409))
    return true

  // Deliberately without the token: it identifies a device.
  log.error(`FCM topic ${subscribe ? 'subscribe' : 'unsubscribe'} failed for topic ${topic}: HTTP ${response.status}`)
  return false
}

/**
 * The v1 topic API authenticates with the same OAuth token `send()` uses, so a
 * legacy server key is no longer sufficient - nor is it accepted.
 */
function requireServiceAccount(operation: string): void {
  if (!config.serviceAccount || !config.projectId) {
    throw new Error(`FCM service account and projectId required for ${operation}`)
  }
}

/**
 * Subscribe tokens to a topic
 */
export async function subscribeToTopic(tokens: string[], topic: string): Promise<boolean> {
  requireServiceAccount('topic subscription')

  const results = await Promise.all(tokens.map(token => setTopicSubscription(token, topic, true)))
  return results.every(Boolean)
}

/**
 * Unsubscribe tokens from a topic
 */
export async function unsubscribeFromTopic(tokens: string[], topic: string): Promise<boolean> {
  requireServiceAccount('topic unsubscription')

  const results = await Promise.all(tokens.map(token => setTopicSubscription(token, topic, false)))
  return results.every(Boolean)
}

export { send as Send }
export default {
  send,
  sendMulticast,
  sendToTopic,
  subscribeToTopic,
  unsubscribeFromTopic,
  configure,
}
