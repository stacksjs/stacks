/**
 * Unsubscribe URL signing + verification (stacksjs/stacks#1880).
 *
 * The framework mints a signed, time-bounded URL the user clicks
 * to opt out of email. The token wraps `{ email, exp }` with an
 * HMAC-SHA256 signature; the default route handler verifies and
 * records a `'unsubscribe'` suppression via {@link suppress}.
 *
 * Token format mirrors `signedStorageToken` (storage#1873 S-14):
 *   `base64url(payload).base64url(signature)`
 *
 * Payload claims:
 *   - `email` — the recipient address being unsubscribed
 *   - `exp`   — epoch seconds expiry (default 30 days)
 *   - `iss`   — issuer ('stacks')
 *
 * Why local rather than route-level signing: the email package
 * needs URLs minted at send time (often in a queue worker without
 * an active request context), but the route signers in
 * `@stacksjs/router` lean on the request URL builder. Lifting just
 * the HMAC chain here keeps the email package's only router dep
 * to the route registration itself.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import process from 'node:process'
import { Buffer } from 'node:buffer'

interface UnsubscribeClaims {
  email: string
  exp: number
  iss: string
}

const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days
const DEFAULT_ROUTE = '/_stacks/email/unsubscribe'

function getAppKey(): string {
  const k = process.env.APP_KEY
  if (!k || k.length < 16) {
    if (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production') {
      throw new Error('[email/unsubscribe] APP_KEY is missing or too short (need ≥16 chars). Cannot sign unsubscribe URL.')
    }
  }
  return k || 'stacks-default-key-dev-only-do-not-use-prod'
}

function b64UrlEncode(buf: Buffer): string {
  return buf.toString('base64url')
}

function b64UrlDecode(s: string): Buffer {
  return Buffer.from(s, 'base64url')
}

/**
 * Mint a signed unsubscribe token for `email`. Default expiry is
 * 30 days — long enough that the link in an archived email still
 * works months later, short enough that a leaked URL doesn't grant
 * indefinite control. Tighter caps available via `ttlSeconds`.
 */
export function createUnsubscribeToken(email: string, ttlSeconds: number = DEFAULT_TTL_SECONDS): string {
  if (!email) throw new Error('[email/unsubscribe] email is required')
  const exp = Math.floor(Date.now() / 1000) + Math.floor(ttlSeconds)
  const claims: UnsubscribeClaims = {
    email: String(email).trim().toLowerCase(),
    exp,
    iss: 'stacks',
  }
  const payload = b64UrlEncode(Buffer.from(JSON.stringify(claims)))
  const sig = b64UrlEncode(createHmac('sha256', getAppKey()).update(payload).digest())
  return `${payload}.${sig}`
}

export interface UnsubscribeVerification {
  valid: boolean
  reason?: 'malformed' | 'bad_signature' | 'expired'
  email?: string
}

/**
 * Verify a signed unsubscribe token. Returns the email + a
 * discriminated outcome — callers map invalid results to a 400/410
 * response and the success case writes the suppression record.
 */
export function verifyUnsubscribeToken(token: string): UnsubscribeVerification {
  if (typeof token !== 'string') return { valid: false, reason: 'malformed' }
  const parts = token.split('.')
  if (parts.length !== 2) return { valid: false, reason: 'malformed' }
  const [payload, sig] = parts as [string, string]

  const expectedSig = createHmac('sha256', getAppKey()).update(payload).digest()
  let provided: Buffer
  try { provided = b64UrlDecode(sig) }
  catch { return { valid: false, reason: 'malformed' } }
  if (provided.length !== expectedSig.length || !timingSafeEqual(provided, expectedSig)) {
    return { valid: false, reason: 'bad_signature' }
  }

  let claims: UnsubscribeClaims
  try {
    claims = JSON.parse(b64UrlDecode(payload).toString('utf8')) as UnsubscribeClaims
  }
  catch { return { valid: false, reason: 'malformed' } }
  if (typeof claims.exp !== 'number' || Math.floor(Date.now() / 1000) >= claims.exp) {
    return { valid: false, reason: 'expired' }
  }
  if (!claims.email || typeof claims.email !== 'string') {
    return { valid: false, reason: 'malformed' }
  }
  return { valid: true, email: claims.email }
}

/**
 * Build the full opt-out URL for `email`. Combines the configured
 * route prefix (`email.unsubscribeRoute`, defaults to
 * `/_stacks/email/unsubscribe`) with the app's public URL (`APP_URL`
 * env var) and the signed token.
 *
 * Pass the result into email bodies / `List-Unsubscribe` headers —
 * see {@link buildListUnsubscribeHeaders} for RFC 8058
 * (one-click) compatibility.
 */
export function buildUnsubscribeUrl(email: string, ttlSeconds?: number, options: { baseUrl?: string, routePrefix?: string } = {}): string {
  const token = createUnsubscribeToken(email, ttlSeconds)
  const base = (options.baseUrl || process.env.APP_URL || 'http://localhost').replace(/\/$/, '')
  const route = (options.routePrefix || DEFAULT_ROUTE).replace(/\/$/, '')
  return `${base}${route}/${token}`
}

/**
 * Build a `List-Unsubscribe` / `List-Unsubscribe-Post` header
 * pair (RFC 8058). Gmail/Apple Mail use these for the native
 * "Unsubscribe" button — without them the user has to find your
 * footer link.
 *
 * Returns a map suitable for passing into `EmailMessage.headers`
 * (or merging with existing headers).
 */
export function buildListUnsubscribeHeaders(email: string, ttlSeconds?: number, options?: { baseUrl?: string, routePrefix?: string }): Record<string, string> {
  const url = buildUnsubscribeUrl(email, ttlSeconds, options)
  return {
    'List-Unsubscribe': `<${url}>`,
    // RFC 8058 — signals to the receiving MTA that POSTing to the URL
    // performs the unsubscribe (one-click flow); Gmail's native button
    // uses this.
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
