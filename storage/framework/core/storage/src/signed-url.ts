/**
 * Signed-URL helpers for the local storage adapter.
 *
 * Mints and verifies JWT-shaped tokens used by `Storage.disk('local').signedUrl()`.
 * The token format is the standard JWS compact serialization:
 *
 *     base64url(header) . base64url(payload) . base64url(signature)
 *
 * with HMAC-SHA256 (`alg: HS256`) over the app key.
 *
 * Claims:
 *   - `iss` — issuer (default `'stacks'`)
 *   - `iat` — issued-at, epoch seconds
 *   - `exp` — expiry, epoch seconds
 *   - `path` — the storage-relative path the token grants access to
 *
 * The route handler MUST match the token's `path` claim against the
 * actual requested path (rather than trusting the URL alone) so an
 * attacker can't tamper with the path segment to access a different
 * file.
 */

import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'
import process from 'node:process'
import type { SignedUrlOptions } from './types'

interface SignedTokenClaims {
  iss: string
  iat: number
  exp: number
  path: string
}

const ALG = 'HS256'

function getAppKey(): string {
  const k = process.env.APP_KEY
  if (!k || k.length < 16) {
    // Fail loud rather than silently using a weak default in production —
    // a 16-char key is the minimum we'll accept for HMAC-SHA256 since
    // anything shorter has insufficient entropy to resist offline attack.
    if (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production') {
      throw new Error('[storage/signed-url] APP_KEY is missing or too short (need ≥16 chars). Cannot sign URL.')
    }
  }
  return k || 'stacks-default-key-dev-only-do-not-use-prod'
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64url')
}

function base64UrlDecode(str: string): Buffer {
  return Buffer.from(str, 'base64url')
}

function normalizeExpiry(expiresIn: number | Date): number {
  if (expiresIn instanceof Date) return Math.floor(expiresIn.getTime() / 1000)
  return Math.floor(Date.now() / 1000) + Math.floor(expiresIn)
}

/**
 * Mint a signed token for the given storage path.
 *
 * @example
 * ```ts
 * const token = createSignedStorageToken('reports/q4.pdf', { expiresIn: 3600 })
 * ```
 */
export function createSignedStorageToken(path: string, options: SignedUrlOptions): string {
  const exp = normalizeExpiry(options.expiresIn)
  const iat = Math.floor(Date.now() / 1000)
  const header = { alg: ALG, typ: 'JWT' }
  const payload: SignedTokenClaims = {
    iss: options.issuer || 'stacks',
    iat,
    exp,
    path,
  }
  const headerPart = base64UrlEncode(Buffer.from(JSON.stringify(header)))
  const payloadPart = base64UrlEncode(Buffer.from(JSON.stringify(payload)))
  const signingInput = `${headerPart}.${payloadPart}`
  const sig = base64UrlEncode(createHmac('sha256', getAppKey()).update(signingInput).digest())
  return `${signingInput}.${sig}`
}

/**
 * Result of verifying a signed token.
 */
export interface SignedTokenVerification {
  valid: boolean
  reason?: 'malformed' | 'bad_signature' | 'expired' | 'path_mismatch'
  claims?: SignedTokenClaims
}

/**
 * Verify a signed storage token. The caller MUST pass the requested
 * path so we can ensure the token's `path` claim matches what the
 * client is trying to fetch — otherwise an attacker could substitute
 * any path in the URL and still pass signature verification.
 *
 * @example
 * ```ts
 * const v = verifySignedStorageToken(req.query.token, requestedPath)
 * if (!v.valid) return new Response('Forbidden', { status: 403 })
 * ```
 */
export function verifySignedStorageToken(token: string, requestedPath: string): SignedTokenVerification {
  if (typeof token !== 'string') {
    return { valid: false, reason: 'malformed' }
  }
  const parts = token.split('.')
  if (parts.length !== 3) {
    return { valid: false, reason: 'malformed' }
  }
  const headerPart = parts[0]!
  const payloadPart = parts[1]!
  const sigPart = parts[2]!
  const signingInput = `${headerPart}.${payloadPart}`
  const expectedSig = createHmac('sha256', getAppKey()).update(signingInput).digest()
  let providedSig: Buffer
  try {
    providedSig = base64UrlDecode(sigPart)
  }
  catch {
    return { valid: false, reason: 'malformed' }
  }
  if (providedSig.length !== expectedSig.length || !timingSafeEqual(providedSig, expectedSig)) {
    return { valid: false, reason: 'bad_signature' }
  }
  let claims: SignedTokenClaims
  try {
    claims = JSON.parse(base64UrlDecode(payloadPart).toString('utf8')) as SignedTokenClaims
  }
  catch {
    return { valid: false, reason: 'malformed' }
  }
  const now = Math.floor(Date.now() / 1000)
  if (typeof claims.exp !== 'number' || now >= claims.exp) {
    return { valid: false, reason: 'expired' }
  }
  // Path-binding: a token issued for `a.txt` must not be reusable to
  // fetch `b.txt`, even though the signature for the URL is technically
  // valid (the URL contains the path verbatim, so substituting it would
  // fail signature anyway — but defense in depth: verify the claim too,
  // since intermediaries / clients could URL-encode differently).
  if (claims.path !== requestedPath) {
    return { valid: false, reason: 'path_mismatch' }
  }
  return { valid: true, claims }
}
