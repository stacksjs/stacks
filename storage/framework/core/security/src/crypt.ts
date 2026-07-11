import { Buffer } from 'node:buffer'
import { config } from '@stacksjs/config'
import { decrypt as cryptoDecrypt, encrypt as cryptoEncrypt } from 'ts-security-crypto'

/**
 * Strip the `base64:` prefix that `./buddy key:generate` writes into
 * APP_KEY. The prefix is a Laravel-compat marker — every passphrase
 * Stacks generates looks like `base64:<32 random bytes, base64-encoded>`.
 * The underlying `ts-security-crypto` passphrase is a string of any
 * shape, so passing the marker through verbatim worked but baked an
 * 8-byte fixed prefix into every PBKDF2 derivation and made
 * passphrases inconsistent with what other tooling (and the docs)
 * call the "key" (stacksjs/stacks#1861 M-10).
 */
function normalizePassphrase(passphrase: string): string {
  return passphrase.startsWith('base64:') ? passphrase.slice('base64:'.length) : passphrase
}

// =============================================================================
// Stacks-side AES-GCM with 600k PBKDF2 iterations (stacksjs/stacks#1866 M-9)
// =============================================================================
//
// `ts-security-crypto` hardcodes PBKDF2-SHA256 at 100,000 iterations.
// OWASP 2026 guidance is ≥600,000 for PBKDF2-SHA256. Since the app key
// passphrase is reused across many encrypt/decrypt calls (token-id
// encryption, userland calls to `encrypt(...)`), this is both a
// performance and security concern.
//
// Stacks now mints all NEW ciphertexts with 600k iterations via the
// `STACKS_CRYPT_V1` format (a 1-byte version marker + 16-byte salt +
// 12-byte IV + ciphertext). Old ts-security-crypto ciphertexts (no
// version marker) still decrypt via the legacy fallback path so live
// data survives the upgrade.
//
// Caching: derived keys are memoised in an LRU keyed by
// `(passphrase, base64(salt), iterations)`. Repeat encrypts/decrypts
// of messages with the same salt + passphrase combination skip the
// 600k-round derivation. The dominant gain is on the decrypt side
// when the same ciphertext is read multiple times in a single
// request; encrypt always uses a fresh salt so each encrypt costs
// one derivation.

const STACKS_CRYPT_V1 = 0x01
const PBKDF2_ITERATIONS_V1 = 600_000
const KEY_BYTES = 32 // AES-256
const SALT_BYTES = 16
const IV_BYTES = 12
const DERIVED_KEY_CACHE_MAX = 64

interface CachedKey {
  key: CryptoKey
  hits: number
}

const derivedKeyCache = new Map<string, CachedKey>()

function cacheKey(passphrase: string, salt: Uint8Array, iterations: number): string {
  return `${iterations}:${Buffer.from(salt).toString('base64')}:${passphrase}`
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const key = cacheKey(passphrase, salt, iterations)
  const cached = derivedKeyCache.get(key)
  if (cached) {
    cached.hits++
    // Refresh LRU position.
    derivedKeyCache.delete(key)
    derivedKeyCache.set(key, cached)
    return cached.key
  }

  const passphraseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )

  const derived = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new Uint8Array(salt), iterations, hash: 'SHA-256' },
    passphraseKey,
    { name: 'AES-GCM', length: KEY_BYTES * 8 },
    false,
    ['encrypt', 'decrypt'],
  )

  derivedKeyCache.set(key, { key: derived, hits: 1 })
  if (derivedKeyCache.size > DERIVED_KEY_CACHE_MAX) {
    const oldest = derivedKeyCache.keys().next().value
    if (oldest !== undefined) derivedKeyCache.delete(oldest)
  }
  return derived
}

async function encryptV1(message: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS_V1)
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(message),
  )
  const cipher = new Uint8Array(cipherBuf)

  // Format: [version=0x01][salt 16][iv 12][cipher N]
  const out = new Uint8Array(1 + SALT_BYTES + IV_BYTES + cipher.byteLength)
  out[0] = STACKS_CRYPT_V1
  out.set(salt, 1)
  out.set(iv, 1 + SALT_BYTES)
  out.set(cipher, 1 + SALT_BYTES + IV_BYTES)
  return Buffer.from(out).toString('base64')
}

async function decryptV1(encrypted: string, passphrase: string): Promise<string | null> {
  const combined = Buffer.from(encrypted, 'base64')
  if (combined.length < 1 + SALT_BYTES + IV_BYTES + 16) return null
  if (combined[0] !== STACKS_CRYPT_V1) return null

  const salt = new Uint8Array(combined.subarray(1, 1 + SALT_BYTES))
  const iv = new Uint8Array(combined.subarray(1 + SALT_BYTES, 1 + SALT_BYTES + IV_BYTES))
  const cipher = new Uint8Array(combined.subarray(1 + SALT_BYTES + IV_BYTES))

  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS_V1)
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
    return new TextDecoder().decode(plain)
  }
  catch {
    return null
  }
}

async function encrypt(message: string, customPassphrase?: string): Promise<string> {
  if (!message && message !== '') {
    throw new Error('encrypt() requires a string message')
  }

  const passphrase = customPassphrase || config.app.key

  if (!passphrase)
    throw new Error('APP_KEY is not defined')

  // New encrypts use the V1 format with 600k iterations. Old
  // ciphertexts continue to decrypt via the legacy fallback in
  // `decrypt`.
  return await encryptV1(message, normalizePassphrase(passphrase))
}

async function decrypt(encrypted: string, customPassphrase?: string): Promise<string> {
  if (!encrypted) {
    throw new Error('decrypt() requires a non-empty encrypted string')
  }

  const passphrase = customPassphrase || config.app.key

  if (!passphrase)
    throw new Error('APP_KEY is not defined')

  const normalized = normalizePassphrase(passphrase)

  // Try V1 first (new format from this commit forward).
  const v1 = await decryptV1(encrypted, normalized)
  if (v1 !== null) return v1

  // Legacy fallback for ciphertexts produced before stacksjs/stacks#1866
  // by ts-security-crypto (100k PBKDF2, no version byte, format
  // [salt 16][iv 12][cipher N]).
  try {
    return await cryptoDecrypt(encrypted, normalized)
  }
  catch (firstErr) {
    // Even older fallback: rows encrypted before stacksjs/stacks#1861
    // M-10 used the un-normalized `base64:…` passphrase. Try that once
    // before giving up so any in-flight data survives the upgrade.
    if (normalized !== passphrase) {
      try {
        return await cryptoDecrypt(encrypted, passphrase)
      }
      catch { /* fall through to the original error */ }
    }
    throw firstErr
  }
}

/**
 * For tests + observability: reset the per-process derived-key cache.
 * Production code never needs to call this — the cache is bounded
 * (`DERIVED_KEY_CACHE_MAX = 64`) and entries evict in FIFO order.
 */
export function _resetCryptCacheForTests(): void {
  derivedKeyCache.clear()
}

// Re-export pre-existing helpers from ts-security-crypto so callers
// that imported them from `@stacksjs/security` keep working.
export { decrypt, encrypt }
export { cryptoEncrypt as legacyEncrypt }
