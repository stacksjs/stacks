import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Thrown when a webhook signature fails verification.
 *
 * Catch this specifically to differentiate signature failures from generic
 * errors. Returning a 400 (rather than 500) on this class is the standard
 * response for failed webhook auth.
 */
export class InvalidWebhookSignature extends Error {
  /** Machine-readable reason — useful for logging without leaking detail to caller */
  readonly reason: 'malformed' | 'expired' | 'mismatch' | 'missing'

  constructor(message: string, reason: 'malformed' | 'expired' | 'mismatch' | 'missing' = 'mismatch') {
    super(message)
    this.name = 'InvalidWebhookSignature'
    this.reason = reason
  }
}

/**
 * Supported webhook providers with built-in signature schemes.
 */
export type WebhookProvider = 'stripe' | 'github' | 'generic'

/**
 * Options controlling webhook verification behavior.
 */
export interface VerifyWebhookOptions {
  /**
   * Maximum age (seconds) of a timestamped signature before rejection.
   * Replay-protection — defaults to 300s (5 min) to match Stripe's recommendation.
   * Only applies to providers that include a timestamp (stripe).
   */
  toleranceSeconds?: number
  /**
   * Algorithm for the generic HMAC scheme. Defaults to 'sha256'.
   * Ignored for `stripe` and `github` (which fix their own algorithm).
   */
  algorithm?: 'sha256' | 'sha512' | 'sha1'
  /**
   * Override the "current time" reference for tolerance checks.
   * Primarily for deterministic testing — never set this in production.
   */
  now?: number
}

/**
 * Convert a hex-encoded string to a Buffer in constant time-friendly fashion.
 * `Buffer.from(s, 'hex')` returns an empty buffer on malformed input rather
 * than throwing — we treat that as "malformed signature" upstream.
 */
function hexToBuffer(hex: string): Buffer {
  // Validate hex chars before decoding so we can fail loudly on garbage.
  if (!/^[0-9a-f]*$/i.test(hex) || hex.length % 2 !== 0)
    throw new InvalidWebhookSignature('Signature is not valid hex', 'malformed')
  return Buffer.from(hex, 'hex')
}

/**
 * Length-safe constant-time equality for two HMAC digests.
 *
 * `timingSafeEqual` requires equal-length buffers; if lengths differ we still
 * do a constant-time comparison against `a` itself (so the work shape doesn't
 * vary) and then return false.
 */
function bufferEquals(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    timingSafeEqual(a, a)
    return false
  }
  return timingSafeEqual(a, b)
}

/**
 * Compute an HMAC digest of `payload` with `secret` and return it as a Buffer.
 */
function hmac(secret: string, payload: string | Buffer, algorithm: string): Buffer {
  return createHmac(algorithm, secret).update(payload).digest()
}

/**
 * Parse a Stripe-Signature header value.
 *
 * Format: `t=1712345678,v1=abc...,v1=def...,v0=...`
 *
 * Stripe rotates secrets by emitting multiple v1 entries — we accept the
 * webhook if ANY v1 entry matches the recomputed signature (still in
 * constant time per entry).
 */
function parseStripeSignature(header: string): { timestamp: number, signatures: string[] } {
  const parts = header.split(',')
  let timestamp = Number.NaN
  const signatures: string[] = []

  for (const part of parts) {
    const idx = part.indexOf('=')
    if (idx === -1)
      continue
    const key = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    if (key === 't')
      timestamp = Number.parseInt(value, 10)
    else if (key === 'v1')
      signatures.push(value)
  }

  if (!Number.isFinite(timestamp) || signatures.length === 0)
    throw new InvalidWebhookSignature('Stripe-Signature header is malformed', 'malformed')

  return { timestamp, signatures }
}

/**
 * Verify a Stripe webhook signature.
 *
 * Stripe signs the concatenation `${timestamp}.${rawBody}` with HMAC-SHA256
 * and includes both the timestamp and signature in the `Stripe-Signature`
 * header. Verification:
 *   1. Parse `t` and `v1=` from the header.
 *   2. Compute HMAC-SHA256(`${t}.${body}`, secret).
 *   3. Compare in constant time against any v1 entry.
 *   4. Reject if `t` is older than `toleranceSeconds` to thwart replay.
 *
 * @example
 * ```ts
 * verifyStripe(secret, request.headers.get('stripe-signature')!, rawBody)
 * ```
 */
export function verifyStripe(
  secret: string,
  signatureHeader: string,
  body: string | Buffer,
  options: VerifyWebhookOptions = {},
): true {
  if (!secret)
    throw new InvalidWebhookSignature('Stripe webhook secret is empty', 'missing')
  if (!signatureHeader)
    throw new InvalidWebhookSignature('Stripe-Signature header is missing', 'missing')

  const { timestamp, signatures } = parseStripeSignature(signatureHeader)

  const tolerance = options.toleranceSeconds ?? 300
  const nowSec = Math.floor((options.now ?? Date.now()) / 1000)
  if (nowSec - timestamp > tolerance)
    throw new InvalidWebhookSignature('Stripe webhook timestamp is outside tolerance window', 'expired')

  const bodyStr = typeof body === 'string' ? body : body.toString('utf8')
  // Stripe signs `${timestamp}.${payload}` — exact concatenation matters.
  const expected = hmac(secret, `${timestamp}.${bodyStr}`, 'sha256')

  for (const sig of signatures) {
    let candidate: Buffer
    try {
      candidate = hexToBuffer(sig)
    }
    catch {
      // Skip a malformed v1 entry — Stripe may include multiple, others may match.
      continue
    }
    if (bufferEquals(expected, candidate))
      return true
  }

  throw new InvalidWebhookSignature('Stripe webhook signature did not match', 'mismatch')
}

/**
 * Verify a GitHub webhook signature.
 *
 * GitHub's `X-Hub-Signature-256` header is `sha256=<hex>` where the hex value
 * is HMAC-SHA256(rawBody, secret). No timestamp is included — replay
 * protection requires application-level idempotency keys (e.g. `X-GitHub-Delivery`).
 *
 * @example
 * ```ts
 * verifyGithub(secret, request.headers.get('x-hub-signature-256')!, rawBody)
 * ```
 */
export function verifyGithub(
  secret: string,
  signatureHeader: string,
  body: string | Buffer,
): true {
  if (!secret)
    throw new InvalidWebhookSignature('GitHub webhook secret is empty', 'missing')
  if (!signatureHeader)
    throw new InvalidWebhookSignature('X-Hub-Signature-256 header is missing', 'missing')

  // Header format: `sha256=<hex>` — strip the prefix.
  const prefix = 'sha256='
  if (!signatureHeader.startsWith(prefix))
    throw new InvalidWebhookSignature('X-Hub-Signature-256 has wrong algorithm prefix', 'malformed')

  const provided = hexToBuffer(signatureHeader.slice(prefix.length))
  const expected = hmac(secret, body, 'sha256')

  if (!bufferEquals(expected, provided))
    throw new InvalidWebhookSignature('GitHub webhook signature did not match', 'mismatch')

  return true
}

/**
 * Verify a generic HMAC signature where the header is just the hex digest.
 *
 * Useful for custom providers that don't bundle a timestamp or scheme prefix.
 * The signature header may optionally start with the algorithm name and `=`
 * (e.g. `sha256=abc...`) — that prefix is stripped if present.
 *
 * @example
 * ```ts
 * verifyHmac(secret, rawBody, request.headers.get('x-signature')!)
 * verifyHmac(secret, rawBody, sig, 'sha512')
 * ```
 */
export function verifyHmac(
  secret: string,
  body: string | Buffer,
  signatureHeader: string,
  algorithm: 'sha256' | 'sha512' | 'sha1' = 'sha256',
): true {
  if (!secret)
    throw new InvalidWebhookSignature('HMAC secret is empty', 'missing')
  if (!signatureHeader)
    throw new InvalidWebhookSignature('Signature header is missing', 'missing')

  // Tolerate an optional `algo=` prefix so callers can pass the raw header through.
  const eq = signatureHeader.indexOf('=')
  const hex = eq !== -1 && /^[a-z0-9]+$/i.test(signatureHeader.slice(0, eq))
    ? signatureHeader.slice(eq + 1)
    : signatureHeader

  const provided = hexToBuffer(hex)
  const expected = hmac(secret, body, algorithm)

  if (!bufferEquals(expected, provided))
    throw new InvalidWebhookSignature('HMAC signature did not match', 'mismatch')

  return true
}

/**
 * Verify a webhook signature against the named provider.
 *
 * Dispatches to provider-specific helpers — see {@link verifyStripe},
 * {@link verifyGithub}, and {@link verifyHmac}. Throws
 * {@link InvalidWebhookSignature} on any failure (malformed header, expired
 * timestamp, mismatched HMAC, or missing input).
 *
 * @param provider  'stripe' | 'github' | 'generic'
 * @param secret    Provider's signing secret (`whsec_...` for Stripe, etc.)
 * @param signature Raw header value as received from the request
 * @param body      Raw request body — must be the bytes-on-the-wire, not parsed JSON
 * @param options   See {@link VerifyWebhookOptions}
 *
 * @example
 * ```ts
 * import { verifyWebhook, InvalidWebhookSignature } from '@stacksjs/security'
 *
 * try {
 *   verifyWebhook('stripe', secret, req.headers.get('stripe-signature')!, rawBody)
 * }
 * catch (e) {
 *   if (e instanceof InvalidWebhookSignature)
 *     return new Response('Invalid signature', { status: 400 })
 *   throw e
 * }
 * ```
 */
export function verifyWebhook(
  provider: WebhookProvider,
  secret: string,
  signature: string,
  body: string | Buffer,
  options: VerifyWebhookOptions = {},
): true {
  switch (provider) {
    case 'stripe':
      return verifyStripe(secret, signature, body, options)
    case 'github':
      return verifyGithub(secret, signature, body)
    case 'generic':
      return verifyHmac(secret, body, signature, options.algorithm ?? 'sha256')
    default:
      // Exhaustiveness guard — surfacing an unknown provider as a typed error
      // rather than a TypeScript-only check makes the failure obvious at runtime.
      throw new InvalidWebhookSignature(`Unknown webhook provider: ${String(provider)}`, 'malformed')
  }
}
