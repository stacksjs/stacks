import { Buffer } from 'node:buffer'

/**
 * Verify an OIDC `id_token` against its issuer's published signing keys.
 *
 * A JWT is three base64url segments, and decoding the middle one takes no
 * secret: anyone can mint a token that *says* `sub: "001234.someoneElse"` and
 * `email_verified: true`. The signature is the only thing separating a claim
 * the issuer made from a claim an attacker typed, so reading claims without
 * checking it is not a weaker check, it is no check at all
 * (stacksjs/stacks#2907).
 *
 * This matters most on the native flow. A server that redeemed the code itself
 * holds the token over TLS straight from the issuer, which OIDC Core 3.1.3.7
 * permits as a substitute for local verification. A server handed a token by a
 * phone has no such guarantee, and the two arrive at the same method as the
 * same string. Verifying always is the only version of this that cannot be
 * held wrong.
 *
 * Scope: RS256 only, which is what both Apple and Google publish. An
 * unexpected `alg` is refused rather than accommodated, because "accept
 * whatever the token asks for" is the shape of every JWT algorithm-confusion
 * bug ever written, `alg: none` included.
 */

/** The RSA fields of a JWK, as a JWKS endpoint publishes them. */
interface SigningKey {
  kty: string
  kid?: string
  alg?: string
  use?: string
  n: string
  e: string
}

export interface VerifyIdTokenOptions {
  /** The issuer's JWKS endpoint, e.g. `https://appleid.apple.com/auth/keys`. */
  jwksUrl: string
  /** The exact `iss` the token must carry. */
  issuer: string
  /** The client id(s) the token must be addressed to. */
  audience: string | string[]
  /** When supplied, the token's `nonce` must match it exactly. */
  nonce?: string
  /** Tolerance for clock drift between this server and the issuer. Default 60s. */
  clockSkewSeconds?: number
  /** Milliseconds since the epoch; injectable so tests need no real clock. */
  now?: number
}

export interface IdTokenClaims {
  iss: string
  aud: string | string[]
  exp: number
  sub: string
  iat?: number
  nbf?: number
  nonce?: string
  [key: string]: unknown
}

/** Cached JWKS responses, keyed by endpoint. */
const keyCache = new Map<string, { keys: SigningKey[], fetchedAt: number }>()

/** How long a fetched key set is reused before it is fetched again. */
const CACHE_TTL_MS = 10 * 60 * 1000

/**
 * The floor between two fetches of the same endpoint.
 *
 * An unknown `kid` triggers a refetch, because that is what key rotation looks
 * like. It is also what a token carrying a random `kid` looks like, and
 * without a floor an attacker could turn one unauthenticated request into one
 * request to Apple, which is a denial-of-service lever pointed at both of us.
 */
const REFETCH_FLOOR_MS = 60 * 1000

/** Drop every cached key set. Exported for tests and key-rotation drills. */
export function clearSigningKeyCache(): void {
  keyCache.clear()
}

async function fetchSigningKeys(jwksUrl: string, now: number): Promise<SigningKey[]> {
  const response = await fetch(jwksUrl)
  if (!response.ok)
    throw new Error(`id_token verification failed: could not fetch signing keys from ${jwksUrl} (HTTP ${response.status})`)

  const body = await response.json() as { keys?: SigningKey[] }
  const keys = Array.isArray(body.keys) ? body.keys : []
  keyCache.set(jwksUrl, { keys, fetchedAt: now })
  return keys
}

/**
 * The key named by `kid`, fetching the key set when it is absent or stale.
 *
 * A miss against a cached set is retried once against a fresh one, so a key
 * rotation does not reject valid tokens until the TTL happens to expire.
 */
async function resolveSigningKey(jwksUrl: string, kid: string, now: number): Promise<SigningKey> {
  const cached = keyCache.get(jwksUrl)
  const fresh = cached !== undefined && now - cached.fetchedAt < CACHE_TTL_MS

  let keys = fresh ? cached.keys : await fetchSigningKeys(jwksUrl, now)
  let key = keys.find(candidate => candidate.kid === kid)

  if (!key && fresh && now - cached.fetchedAt >= REFETCH_FLOOR_MS) {
    keys = await fetchSigningKeys(jwksUrl, now)
    key = keys.find(candidate => candidate.kid === kid)
  }

  if (!key)
    throw new Error(`id_token verification failed: no signing key matches kid "${kid}"`)

  if (key.kty !== 'RSA')
    throw new Error(`id_token verification failed: signing key "${kid}" is ${key.kty}, expected RSA`)

  return key
}

function decodeSegment(segment: string, what: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as Record<string, unknown>
  }
  catch {
    throw new Error(`id_token verification failed: ${what} is not valid JSON`)
  }
}

/**
 * Verify `token` and return its claims.
 *
 * Throws on anything short of a complete pass: a bad signature, an unknown
 * key, the wrong issuer or audience, an expired or not-yet-valid token, or a
 * nonce that does not match the one expected. The returned claims have been
 * verified; nothing else in this module hands back unverified ones.
 */
export async function verifyIdToken(token: string, options: VerifyIdTokenOptions): Promise<IdTokenClaims> {
  const parts = token.split('.')
  if (parts.length !== 3)
    throw new Error('id_token verification failed: malformed token')

  const [rawHeader, rawPayload, rawSignature] = parts as [string, string, string]
  const header = decodeSegment(rawHeader, 'header')

  if (header.alg !== 'RS256')
    throw new Error(`id_token verification failed: unsupported algorithm ${JSON.stringify(header.alg)}, expected RS256`)

  if (typeof header.kid !== 'string' || header.kid === '')
    throw new Error('id_token verification failed: header has no kid')

  const now = options.now ?? Date.now()
  const key = await resolveSigningKey(options.jwksUrl, header.kid, now)

  // Rebuilt from the fields this verification depends on, rather than passed
  // through: `use`, `key_ops` and unknown members are the caller's business,
  // not ours, and importKey rejects some combinations of them.
  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    { kty: 'RSA', n: key.n, e: key.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  const signed = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    Buffer.from(rawSignature, 'base64url'),
    Buffer.from(`${rawHeader}.${rawPayload}`),
  )

  if (!signed)
    throw new Error('id_token verification failed: signature does not match the issuer\'s key')

  // Only now are the claims worth reading.
  const claims = decodeSegment(rawPayload, 'payload') as IdTokenClaims
  const skewMs = (options.clockSkewSeconds ?? 60) * 1000

  if (claims.iss !== options.issuer)
    throw new Error(`id_token verification failed: issuer is ${JSON.stringify(claims.iss)}, expected ${JSON.stringify(options.issuer)}`)

  const accepted = Array.isArray(options.audience) ? options.audience : [options.audience]
  const presented = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (!presented.some(one => accepted.includes(one)))
    throw new Error('id_token verification failed: token is addressed to a different client')

  if (typeof claims.exp !== 'number' || claims.exp * 1000 + skewMs <= now)
    throw new Error('id_token verification failed: token has expired')

  if (typeof claims.iat === 'number' && claims.iat * 1000 - skewMs > now)
    throw new Error('id_token verification failed: token was issued in the future')

  if (typeof claims.nbf === 'number' && claims.nbf * 1000 - skewMs > now)
    throw new Error('id_token verification failed: token is not valid yet')

  if (options.nonce !== undefined && claims.nonce !== options.nonce)
    throw new Error('id_token verification failed: nonce does not match')

  if (typeof claims.sub !== 'string' || claims.sub === '')
    throw new Error('id_token verification failed: token has no subject')

  return claims
}
