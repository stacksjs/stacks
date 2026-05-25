/**
 * Per-provider webhook signature verification (stacksjs/stacks#1881).
 *
 * Each provider signs its outgoing webhook differently:
 *
 *   - Mailgun: HMAC-SHA256 over `timestamp+token` with the webhook
 *              signing key. Constant-time compare.
 *
 *   - Postmark: HTTP Basic Auth (username `'stacks'` or app-chosen,
 *               password = the webhook secret) PLUS source-IP
 *               allowlist. Postmark doesn't sign the body — they
 *               rely on the auth + IP combo to authenticate.
 *
 *   - SES (SNS): SHA1-RSA signature over a canonical message form
 *                using a cert published at a `SigningCertURL`. Cert
 *                URL must match the standard SNS pattern
 *                (`sns.<region>.amazonaws.com` host) to prevent
 *                SSRF against an attacker-controlled URL.
 *
 *   - SendGrid: ECDSA over `timestamp + body` with the public key
 *               from their dashboard. P-256 curve, DER signature.
 *
 * Each function takes the bits it needs (request body, headers,
 * configured secret) and returns a discriminated `{ ok, reason? }`
 * — the route handler maps `ok: false` to a 401/403 without
 * touching the rest of the pipeline.
 */

import { createHmac, createVerify, timingSafeEqual } from 'node:crypto'
import { Buffer } from 'node:buffer'

export type SignatureVerification =
  | { ok: true }
  | { ok: false, reason: 'missing-config' | 'missing-signature' | 'bad-signature' | 'expired' | 'untrusted-cert-url' | 'cert-fetch-failed' }

// =============================================================================
// Mailgun
// =============================================================================

export interface MailgunSignatureInput {
  /** Timestamp from `signature.timestamp` in the webhook payload. */
  timestamp: string
  /** Token from `signature.token` in the webhook payload. */
  token: string
  /** Signature from `signature.signature` in the webhook payload. */
  signature: string
  /** Mailgun's webhook signing key (from config or env). */
  signingKey: string
  /**
   * Maximum age of `timestamp` in seconds before the request is
   * rejected as a replay. Default 5 minutes — matches Mailgun's
   * recommended window.
   */
  toleranceSeconds?: number
}

/**
 * Verify a Mailgun webhook signature. Mailgun signs
 * `${timestamp}${token}` with HMAC-SHA256; the hex digest is
 * compared in constant time against the `signature` field.
 *
 * The timestamp is checked against wall clock with a configurable
 * tolerance (default 5 minutes) to reject replays. Constant-time
 * compare prevents signature-timing oracles.
 */
export function verifyMailgunSignature(input: MailgunSignatureInput): SignatureVerification {
  if (!input.signingKey) return { ok: false, reason: 'missing-config' }
  if (!input.timestamp || !input.token || !input.signature)
    return { ok: false, reason: 'missing-signature' }

  const tolerance = input.toleranceSeconds ?? 300
  const ts = Number(input.timestamp)
  if (!Number.isFinite(ts)) return { ok: false, reason: 'bad-signature' }
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > tolerance) return { ok: false, reason: 'expired' }

  const expected = createHmac('sha256', input.signingKey)
    .update(`${input.timestamp}${input.token}`)
    .digest('hex')

  let provided: Buffer
  try { provided = Buffer.from(input.signature, 'hex') }
  catch { return { ok: false, reason: 'bad-signature' } }
  const expectedBuf = Buffer.from(expected, 'hex')
  if (provided.length !== expectedBuf.length) return { ok: false, reason: 'bad-signature' }
  if (!timingSafeEqual(provided, expectedBuf)) return { ok: false, reason: 'bad-signature' }
  return { ok: true }
}

// =============================================================================
// Postmark
// =============================================================================

export interface PostmarkAuthInput {
  /** Value of the `Authorization` request header. */
  authorizationHeader: string | null | undefined
  /** Expected username (caller-chosen, configured in Postmark dashboard). */
  expectedUsername: string
  /** Expected password (the webhook secret, configured in Postmark dashboard). */
  expectedPassword: string
  /**
   * Optional source IP for the IP-allowlist check. Postmark publishes
   * their webhook source IPs at https://postmarkapp.com/support/article/800-…
   * Pass the list configured for your account; omit to skip.
   */
  sourceIp?: string
  ipAllowlist?: ReadonlyArray<string>
}

/**
 * Verify a Postmark webhook. Postmark uses HTTP Basic Auth (the app
 * configures the username + password when registering the webhook in
 * the Postmark dashboard); they don't sign the body. The auth check
 * is constant-time. Optional IP-allowlist check rejects requests
 * from outside Postmark's published source IPs.
 */
export function verifyPostmarkAuth(input: PostmarkAuthInput): SignatureVerification {
  if (!input.expectedUsername || !input.expectedPassword)
    return { ok: false, reason: 'missing-config' }

  if (!input.authorizationHeader || !input.authorizationHeader.startsWith('Basic '))
    return { ok: false, reason: 'missing-signature' }

  let decoded: string
  try {
    decoded = Buffer.from(input.authorizationHeader.slice(6), 'base64').toString('utf8')
  }
  catch { return { ok: false, reason: 'bad-signature' } }

  const [user, pass] = decoded.split(':')
  if (!user || pass === undefined) return { ok: false, reason: 'bad-signature' }

  // Constant-time compare both fields. Equal-length pad prevents
  // length-leak via timingSafeEqual's own length check.
  const userMatch = safeStringEquals(user, input.expectedUsername)
  const passMatch = safeStringEquals(pass, input.expectedPassword)
  if (!userMatch || !passMatch) return { ok: false, reason: 'bad-signature' }

  if (input.ipAllowlist && input.ipAllowlist.length > 0) {
    if (!input.sourceIp || !input.ipAllowlist.includes(input.sourceIp))
      return { ok: false, reason: 'bad-signature' }
  }

  return { ok: true }
}

function safeStringEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8')
  const bBuf = Buffer.from(b, 'utf8')
  if (aBuf.length !== bBuf.length) {
    // Still consume time proportional to the longer buffer so the
    // length check doesn't leak.
    const dummy = Buffer.alloc(Math.max(aBuf.length, bBuf.length))
    timingSafeEqual(dummy, dummy)
    return false
  }
  return timingSafeEqual(aBuf, bBuf)
}

// =============================================================================
// SES (via SNS)
// =============================================================================

export interface SesSnsSignatureInput {
  /** Full parsed SNS message body (the JSON Amazon POSTs). */
  message: {
    Type: 'Notification' | 'SubscriptionConfirmation' | 'UnsubscribeConfirmation'
    MessageId: string
    TopicArn: string
    Subject?: string
    Message: string
    Timestamp: string
    SignatureVersion: string
    Signature: string
    SigningCertURL: string
    Token?: string
    SubscribeURL?: string
    [key: string]: unknown
  }
  /**
   * Async helper to fetch the signing cert. Injected so callers
   * can control the HTTP client (timeouts, retries, mocks for tests).
   * Default fetcher uses the global `fetch` — see {@link defaultCertFetcher}.
   */
  fetchCert?: (url: string) => Promise<string>
  /**
   * Allowed host pattern for `SigningCertURL`. Without this, an
   * attacker could POST an SNS-shaped message pointing at their own
   * cert — defaults to `/^sns\.[a-z0-9-]+\.amazonaws\.com$/` which
   * matches every AWS region.
   */
  certUrlHostAllowlist?: RegExp
}

const DEFAULT_SNS_HOST_ALLOWLIST = /^sns\.[a-z0-9-]+\.amazonaws\.com$/

async function defaultCertFetcher(url: string): Promise<string> {
  const res = await fetch(url, { redirect: 'error' })
  if (!res.ok) throw new Error(`SNS cert fetch returned ${res.status}`)
  return await res.text()
}

/**
 * Verify an SNS message signature (SES uses SNS for delivery). The
 * cert URL host MUST match `sns.<region>.amazonaws.com` — any other
 * host is treated as untrusted (defense against SSRF via crafted
 * SigningCertURL).
 *
 * Note: this function intentionally only does the structural +
 * cert-URL check + signature verify. SubscriptionConfirmation
 * handling (responding to `SubscribeURL` to complete the topic
 * binding) is the route handler's job since it's a one-time setup
 * action distinct from per-event verification.
 */
export async function verifySesSnsSignature(input: SesSnsSignatureInput): Promise<SignatureVerification> {
  const msg = input.message
  if (!msg || !msg.Signature || !msg.SigningCertURL) return { ok: false, reason: 'missing-signature' }

  const allowlist = input.certUrlHostAllowlist ?? DEFAULT_SNS_HOST_ALLOWLIST
  let certUrl: URL
  try { certUrl = new URL(msg.SigningCertURL) }
  catch { return { ok: false, reason: 'untrusted-cert-url' } }
  if (certUrl.protocol !== 'https:') return { ok: false, reason: 'untrusted-cert-url' }
  if (!allowlist.test(certUrl.host)) return { ok: false, reason: 'untrusted-cert-url' }

  let certPem: string
  try { certPem = await (input.fetchCert ?? defaultCertFetcher)(msg.SigningCertURL) }
  catch { return { ok: false, reason: 'cert-fetch-failed' } }

  // Build the canonical string-to-sign per SNS docs. The field set
  // varies by Message Type — Notifications include Subject if
  // present; SubscriptionConfirmation uses Token + SubscribeURL.
  const canonical = canonicalSnsString(msg)
  if (!canonical) return { ok: false, reason: 'bad-signature' }

  let sigBuf: Buffer
  try { sigBuf = Buffer.from(msg.Signature, 'base64') }
  catch { return { ok: false, reason: 'bad-signature' } }

  const algo = msg.SignatureVersion === '2' ? 'SHA256' : 'SHA1'
  const verifier = createVerify(`RSA-${algo}`)
  verifier.update(canonical, 'utf8')
  const valid = verifier.verify(certPem, sigBuf)
  return valid ? { ok: true } : { ok: false, reason: 'bad-signature' }
}

function canonicalSnsString(msg: SesSnsSignatureInput['message']): string | null {
  // Spec: https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html
  // Sorted key order with newline separators, key + \n + value + \n.
  const fields: string[] = []
  if (msg.Type === 'Notification') {
    fields.push('Message', msg.Message)
    fields.push('MessageId', msg.MessageId)
    if (msg.Subject !== undefined) fields.push('Subject', msg.Subject)
    fields.push('Timestamp', msg.Timestamp)
    fields.push('TopicArn', msg.TopicArn)
    fields.push('Type', msg.Type)
  }
  else if (msg.Type === 'SubscriptionConfirmation' || msg.Type === 'UnsubscribeConfirmation') {
    fields.push('Message', msg.Message)
    fields.push('MessageId', msg.MessageId)
    if (!msg.SubscribeURL || !msg.Token) return null
    fields.push('SubscribeURL', msg.SubscribeURL)
    fields.push('Timestamp', msg.Timestamp)
    fields.push('Token', msg.Token)
    fields.push('TopicArn', msg.TopicArn)
    fields.push('Type', msg.Type)
  }
  else {
    return null
  }
  let out = ''
  for (const f of fields) out += `${f}\n`
  return out
}

// =============================================================================
// SendGrid
// =============================================================================

export interface SendgridSignatureInput {
  /** Raw request body (string). */
  body: string
  /** Value of the `X-Twilio-Email-Event-Webhook-Signature` header. */
  signature: string | null | undefined
  /** Value of the `X-Twilio-Email-Event-Webhook-Timestamp` header. */
  timestamp: string | null | undefined
  /**
   * Public key from the SendGrid Event Webhook signed setup page,
   * PEM-encoded. SendGrid uses ECDSA on the P-256 curve.
   */
  publicKeyPem: string
  /** Replay tolerance in seconds (default 300). */
  toleranceSeconds?: number
}

/**
 * Verify a SendGrid Event Webhook signature. SendGrid signs
 * `${timestamp}${body}` with ECDSA-SHA256 using the public key from
 * their signed-webhook setup page. Signature is base64 in the
 * `X-Twilio-Email-Event-Webhook-Signature` header.
 */
export function verifySendgridSignature(input: SendgridSignatureInput): SignatureVerification {
  if (!input.publicKeyPem) return { ok: false, reason: 'missing-config' }
  if (!input.signature || !input.timestamp) return { ok: false, reason: 'missing-signature' }

  const tolerance = input.toleranceSeconds ?? 300
  const ts = Number(input.timestamp)
  if (!Number.isFinite(ts)) return { ok: false, reason: 'bad-signature' }
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > tolerance) return { ok: false, reason: 'expired' }

  let sigBuf: Buffer
  try { sigBuf = Buffer.from(input.signature, 'base64') }
  catch { return { ok: false, reason: 'bad-signature' } }

  const verifier = createVerify('SHA256')
  verifier.update(`${input.timestamp}${input.body}`, 'utf8')
  const valid = verifier.verify(input.publicKeyPem, sigBuf)
  return valid ? { ok: true } : { ok: false, reason: 'bad-signature' }
}
