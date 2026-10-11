import type { PushResult } from '@stacksjs/types'
import { createPrivateKey, sign } from 'node:crypto'
import http2, { constants } from 'node:http2'
import { appServices, present } from '../app-config'

export interface APNSConfig {
  teamId?: string
  keyId?: string
  privateKey?: string
  topic?: string
  sandbox?: boolean
}
export interface APNSMessage {
  title?: string
  body: string
  data?: Record<string, unknown>
  badge?: number
  sound?: 'default' | null
  priority?: 'high' | 'normal' | 'default'
  collapseId?: string
}
let configured: APNSConfig = {}
let cached: { identity: string, token: string, issuedAt: number } | undefined
export function configure(options: APNSConfig): void { configured = { ...options }; cached = undefined }
export function resetConfiguration(): void { configured = {}; cached = undefined }

export function buildProviderToken(teamId: string, keyId: string, privateKey: string, now = Math.floor(Date.now() / 1000)): string {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId })).toString('base64url')
  const claims = Buffer.from(JSON.stringify({ iss: teamId, iat: now })).toString('base64url')
  const unsigned = `${header}.${claims}`
  const key = createPrivateKey(privateKey.replace(/\\n/g, '\n'))
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new Error('APNs requires an ES256 P-256 signing key')
  return `${unsigned}.${sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`
}

export function buildPayload(message: APNSMessage): string {
  const payload = JSON.stringify({ ...message.data, aps: {
    alert: { title: message.title ?? '', body: message.body },
    ...(message.sound !== null ? { sound: message.sound ?? 'default' } : {}),
    ...(message.badge !== undefined ? { badge: message.badge } : {}),
  } })
  if (Buffer.byteLength(payload) > 4096) throw new Error('APNs notification exceeds 4096 bytes')
  return payload
}

/** Apple device tokens come from the native bridge, independently of Firebase. */
export async function send(to: string | string[], message: APNSMessage): Promise<PushResult> {
  const tokens = Array.isArray(to) ? to : [to]
  if (!tokens.length || tokens.some(token => !/^[a-f\d]{64}$/i.test(token))) return { success: false, provider: 'apns', message: 'A valid Apple device token is required' }
  const service = (await appServices()).apns
  const teamId = present(configured.teamId) ?? present(service?.teamId)
  const keyId = present(configured.keyId) ?? present(service?.keyId)
  const privateKey = present(configured.privateKey) ?? present(service?.privateKey)
  const topic = present(configured.topic) ?? present(service?.topic)
  if (!teamId || !keyId || !privateKey || !topic) return { success: false, provider: 'apns', message: 'APNs requires teamId, keyId, privateKey and topic' }
  try {
    const payload = buildPayload(message)
    const now = Math.floor(Date.now() / 1000)
    const identity = `${teamId}:${keyId}:${privateKey}`
    if (!cached || cached.identity !== identity || now - cached.issuedAt >= 3000 || now < cached.issuedAt) cached = { identity, token: buildProviderToken(teamId, keyId, privateKey, now), issuedAt: now }
    const token = cached.token
    const session = http2.connect(configured.sandbox ?? service?.sandbox ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com')
    session.on('error', () => {})
    try {
      const results = await Promise.all(tokens.map(deviceToken => new Promise<{ success: boolean, status: number, reason?: string, messageId?: string }>((resolve) => {
        const stream = session.request({ ':method': 'POST', ':path': `/3/device/${deviceToken}`, authorization: `bearer ${token}`, 'apns-topic': topic, 'apns-push-type': 'alert', 'apns-priority': message.priority === 'normal' ? '5' : '10', 'content-type': 'application/json', ...(message.collapseId ? { 'apns-collapse-id': message.collapseId } : {}) })
        let status = 0, body = '', messageId: string | undefined
        stream.setEncoding('utf8')
        const deadline = setTimeout(() => { stream.close(constants.NGHTTP2_CANCEL); resolve({ success: false, status: 0, reason: 'Timeout' }) }, 15000)
        stream.on('close', () => { clearTimeout(deadline); resolve({ success: false, status, reason: 'TransportClosed' }) })
        stream.on('response', headers => { status = Number(headers[':status']); messageId = String(headers['apns-id'] ?? '') || undefined })
        stream.on('data', chunk => { body += chunk })
        stream.on('error', () => resolve({ success: false, status, reason: 'TransportError' }))
        stream.on('end', () => {
          let reason: string | undefined
          try { reason = JSON.parse(body).reason } catch { /* successful responses have no body */ }
          resolve({ success: status === 200, status, reason, messageId })
        })
        stream.end(payload)
      })))
      const accepted = results.filter(result => result.success).length
      return { success: accepted === tokens.length, provider: 'apns', message: `Apple accepted ${accepted}/${tokens.length} notifications`, messageId: results[0]?.messageId, data: { results } }
    }
    finally { session.destroy() }
  }
  catch (error) { return { success: false, provider: 'apns', message: error instanceof Error ? error.message : 'APNs delivery failed' } }
}
