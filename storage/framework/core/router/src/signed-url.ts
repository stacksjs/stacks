/**
 * HMAC-signed URLs for temporary-access links.
 *
 * Implements Laravel's `URL::signedRoute(...)` + `URL::hasValidSignature()`
 * shape: produce a URL with an `expires` timestamp and a `signature` query
 * parameter that HMAC-covers the rest of the URL, then verify both at
 * request time before letting the action run.
 *
 * Use cases: email-verification links, password reset, unsubscribe,
 * one-time download URLs, magic-login. Anything where you'd rather not
 * hand out a long-lived bearer token but still need a single URL that
 * proves it came from you.
 *
 * See stacksjs/stacks#1870 R-7.
 */

import type { EnhancedRequest } from '@stacksjs/bun-router'
import { timingSafeEqual } from 'node:crypto'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { url as buildUrl } from './stacks-router'

const SIGNATURE_PARAM = 'signature'
const EXPIRES_PARAM = 'expires'

/**
 * Resolve the secret to sign with. Prefers `APP_KEY` (matches the rest of
 * Stacks' crypto layer) and falls back to `STACKS_SIGNED_URL_SECRET`. If
 * neither is set, throws — silently signing with an empty key would mean
 * every link is forge-able by anyone who reads the source.
 *
 * Kept as a function (not a module-level const) so test setups that
 * mutate `process.env` mid-run pick up the new value.
 */
function getSigningSecret(): string {
  const secret = process.env.APP_KEY || process.env.STACKS_SIGNED_URL_SECRET
  if (!secret || secret.length < 16) {
    throw new Error(
      '[router] signed URLs require APP_KEY (≥ 16 chars) or STACKS_SIGNED_URL_SECRET. '
      + 'Run `./buddy key:generate` or set the env var.',
    )
  }
  return secret
}

function hmacHex(payload: string, secret: string): string {
  return new Bun.CryptoHasher('sha256', secret).update(payload).digest('hex')
}

/**
 * Hash equality that doesn't leak length / position via early-return.
 * Wrapped here because Bun's hex strings can vary by case across
 * runtimes — normalise to lower then compare byte-wise.
 */
function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a.toLowerCase(), 'hex')
  const bb = Buffer.from(b.toLowerCase(), 'hex')
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/** Strip the `signature` (and optionally `expires`) param from a URL string. */
function stripSignatureParam(input: URL): URL {
  const u = new URL(input.toString())
  u.searchParams.delete(SIGNATURE_PARAM)
  return u
}

/**
 * Payload to HMAC. We sign the entire URL minus the `signature` param
 * itself — the `expires` param IS covered so a caller can't extend the
 * window by tweaking the timestamp without the secret. Query-param order
 * is canonicalised (URLSearchParams sorted) so identical URLs produce
 * identical signatures regardless of how they were composed.
 */
function buildSignaturePayload(input: URL): string {
  const stripped = stripSignatureParam(input)
  stripped.searchParams.sort()
  return stripped.toString()
}

export interface SignedUrlOptions {
  /**
   * Absolute expiry (Unix seconds). Mutually exclusive with `ttl`. When
   * both are omitted, the URL never expires — fine for short-lived
   * single-use tokens that you tombstone elsewhere; risky for anything
   * else.
   */
  expiresAt?: number
  /** Seconds-from-now expiry. Wins over `expiresAt` when both are passed. */
  ttl?: number
}

/**
 * Sign an existing URL (full or path-only). Returns a new URL string
 * with `expires` (optional) and `signature` query params appended.
 *
 * Path-only inputs (`/api/email/verify?user=42`) inherit `APP_URL` as
 * the origin — same convention as {@link buildUrl}.
 */
export function signUrl(input: string, options: SignedUrlOptions = {}): string {
  const secret = getSigningSecret()
  const url = input.startsWith('http')
    ? new URL(input)
    : new URL(input.startsWith('/') ? input : `/${input}`, process.env.APP_URL || 'https://localhost')

  if (options.ttl !== undefined && options.expiresAt !== undefined) {
    // ttl wins — documented above, but warn-once so the caller can fix
    // the duplication rather than wonder why one of the two was ignored.
    warnOnce('dual-expiry', '[router] signUrl: both `ttl` and `expiresAt` provided — using `ttl`.')
  }

  if (options.ttl !== undefined) {
    url.searchParams.set(EXPIRES_PARAM, String(Math.floor(Date.now() / 1000) + options.ttl))
  }
  else if (options.expiresAt !== undefined) {
    url.searchParams.set(EXPIRES_PARAM, String(Math.floor(options.expiresAt)))
  }

  const payload = buildSignaturePayload(url)
  url.searchParams.set(SIGNATURE_PARAM, hmacHex(payload, secret))
  return url.toString()
}

/** One-time warning gate. Keyed so future warnings here can share it. */
const _warnedKeys = new Set<string>()
function warnOnce(key: string, message: string): void {
  if (_warnedKeys.has(key)) return
  _warnedKeys.add(key)
  console.warn(message)
}

/**
 * Convenience wrapper that resolves a named route to a URL via {@link buildUrl}
 * and then signs it. Mirrors Laravel's `URL::signedRoute()`.
 *
 * @example
 * ```ts
 * route.get('/api/email/verify', VerifyEmailAction).name('email.verify')
 * const link = signedUrl('email.verify', { user: 42 }, { ttl: 60 * 60 * 24 })
 * // → https://app.example.com/api/email/verify?user=42&expires=1716470400&signature=…
 * ```
 */
export function signedUrl(
  routeName: string,
  params: Record<string, string | number> = {},
  options: SignedUrlOptions = {},
): string {
  return signUrl(buildUrl(routeName, params), options)
}

/**
 * Result of {@link verifySignedUrl}. The `reason` only fires when `valid`
 * is `false` — gives callers (and middleware) enough to decide whether
 * to log, return 401, or return 410 (expired vs. tampered).
 */
export type SignedUrlVerifyResult =
  | { valid: true }
  | { valid: false, reason: 'missing-signature' | 'expired' | 'invalid-signature' }

/**
 * Verify the `signature` (and optional `expires`) on an incoming URL.
 * Returns a discriminated result so callers can pick their own status
 * code per failure mode.
 */
export function verifySignedUrl(input: string | URL): SignedUrlVerifyResult {
  const url = typeof input === 'string' ? new URL(input, process.env.APP_URL || 'https://localhost') : input
  const presented = url.searchParams.get(SIGNATURE_PARAM)
  if (!presented) return { valid: false, reason: 'missing-signature' }

  const expiresRaw = url.searchParams.get(EXPIRES_PARAM)
  if (expiresRaw !== null) {
    const expires = Number.parseInt(expiresRaw, 10)
    if (!Number.isFinite(expires) || Date.now() / 1000 > expires) {
      return { valid: false, reason: 'expired' }
    }
  }

  try {
    const expected = hmacHex(buildSignaturePayload(url), getSigningSecret())
    return safeEqualHex(presented, expected)
      ? { valid: true }
      : { valid: false, reason: 'invalid-signature' }
  }
  catch {
    // Missing secret — treat as invalid rather than crash the request.
    // The throw from getSigningSecret is the boot-time signal; at
    // request time we just refuse.
    return { valid: false, reason: 'invalid-signature' }
  }
}

/**
 * Middleware shape for `route.middleware('signed')`. Verifies the
 * incoming URL's signature and throws a `Response` (the router's
 * short-circuit contract) when it fails. Drop in as a route-level
 * middleware on any URL minted by {@link signedUrl}.
 *
 * @example
 * ```ts
 * route.get('/email/verify', 'Actions/VerifyEmail').middleware('signed')
 * ```
 */
export async function verifySignedUrlMiddleware(req: EnhancedRequest): Promise<void> {
  const result = verifySignedUrl(req.url)
  if (result.valid) return
  // 410 Gone for expired (the link existed but is no longer valid);
  // 401 Unauthorized for missing/tampered (the caller doesn't have
  // a usable credential). Both shapes are documented in RFC 7231 §6.
  const status = result.reason === 'expired' ? 410 : 401
  throw Response.json({ error: result.reason }, { status })
}
