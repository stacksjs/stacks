import { createHash, randomBytes } from 'node:crypto'

/**
 * API keys a server hands out to integrations: a random secret shown to its
 * owner once, stored only as a SHA-256 digest. The secret is 32 random bytes,
 * so a fast hash is enough; there is nothing to brute-force the way there is
 * with a password.
 */
export interface GeneratedApiKey {
  /** The full key. Show it once; never store it. */
  key: string
  /** SHA-256 hex of the key: what to store and look up by. */
  hash: string
  /** What a list may show: the prefix, the first four and the last four characters. */
  hint: string
}

/** SHA-256 hex of an API key, for storing and for looking one up. */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex')
}

/** `prefix` + a few characters from each end of the secret, e.g. `hq_live_AbCd…wxYz`. */
export function apiKeyHint(key: string, prefix = ''): string {
  const secret = prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key
  if (secret.length <= 8)
    return `${prefix}…`
  return `${prefix}${secret.slice(0, 4)}…${secret.slice(-4)}`
}

/**
 * A new API key: `prefix` (say `myapp_live_`) followed by `bytes` random bytes
 * in base64url. The prefix makes a leaked key recognisable to secret scanners
 * and to the person who finds it.
 */
export function generateApiKey(prefix = '', bytes = 32): GeneratedApiKey {
  if (!Number.isInteger(bytes) || bytes < 16)
    throw new Error('An API key needs at least 16 random bytes')
  const key = `${prefix}${randomBytes(bytes).toString('base64url')}`
  return { key, hash: hashApiKey(key), hint: apiKeyHint(key, prefix) }
}
