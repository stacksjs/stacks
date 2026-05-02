/**
 * Encrypted-attribute helpers.
 *
 * Used by `define-model.ts` when a model declares
 * `attributes: { ssn: { type: 'string', encrypted: true } }` to transparently
 * encrypt on write and decrypt on read.
 *
 * ### Cipher format
 *
 * Stored values use a self-describing string so raw DB dumps are obvious:
 *
 * ```
 * enc:<iv-base64>:<auth-tag-base64>:<ciphertext-base64>
 * ```
 *
 * The `enc:` prefix doubles as an idempotency marker — passing an already-
 * encrypted value back through `encryptValue()` returns it unchanged. This
 * makes backfill migrations safer: re-running an encrypt loop is a no-op
 * instead of double-encrypting and corrupting the column.
 *
 * ### Algorithm
 *
 * AES-256-GCM with a fresh 12-byte IV per write. The key is derived from
 * the app key (config.app.key / APP_KEY) by SHA-256 hashing — this means
 * any APP_KEY length (the framework default is base64) yields a usable
 * 32-byte key.
 *
 * ### Failure mode
 *
 * `decryptValue()` deliberately swallows decrypt errors and returns null
 * after logging a warning. Reasons:
 *   - Key rotation: an old row encrypted under a previous APP_KEY will
 *     fail to decrypt, but failing the whole read would render the row
 *     unrecoverable. Returning null lets the app keep functioning while
 *     a re-encrypt job runs.
 *   - Mid-migration: a row written before the trait was on doesn't have
 *     the `enc:` prefix; we return it as-is rather than crash.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { log } from '@stacksjs/logging'

const PREFIX = 'enc:'
const ALGO = 'aes-256-gcm'
const IV_LEN = 12 // GCM-recommended nonce length; ciphertext-derived key bytes are unaffected.

let _cachedKey: Buffer | null = null

/**
 * Resolve and cache the 32-byte encryption key derived from the app key.
 * Read order:
 *   1. `process.env.APP_KEY` (works in every runtime, including before
 *      `@stacksjs/config` has finished evaluating).
 *   2. `config.app.key` via lazy import (works inside the running app).
 *
 * The cache is keyed by the concrete key value — if APP_KEY is rotated at
 * runtime by an external mechanism the cache is intentionally NOT
 * invalidated automatically. This is the safer default: an attacker who
 * could flip APP_KEY mid-process could otherwise force every subsequent
 * read to use the new key and silently fail. Apps that genuinely rotate
 * keys at runtime should call `_clearEncryptedKeyCache()` themselves.
 */
async function getKey(): Promise<Buffer | null> {
  if (_cachedKey) return _cachedKey
  let raw: string | undefined = process.env.APP_KEY
  if (!raw) {
    try {
      const cfg = await import('@stacksjs/config').catch(() => null)
      raw = cfg?.config?.app?.key as string | undefined
    }
    catch { /* config not available — fall through to null */ }
  }
  if (!raw) return null
  // SHA-256 deterministically produces 32 bytes regardless of APP_KEY's
  // own length / encoding (base64, hex, raw). Same input → same key.
  _cachedKey = createHash('sha256').update(raw).digest()
  return _cachedKey
}

/**
 * Internal escape hatch for tests / key-rotation flows that need to force
 * the next read to re-derive the key from APP_KEY. Not exported from the
 * package barrel on purpose.
 */
export function _clearEncryptedKeyCache(): void {
  _cachedKey = null
}

/**
 * Returns true iff `value` is a string that already carries the
 * `enc:` envelope. Used by both the encrypt and decrypt paths to make
 * each idempotent.
 *
 * @example
 * ```ts
 * isEncrypted('enc:AAA:BBB:CCC') // → true
 * isEncrypted('plain string')    // → false
 * ```
 */
export function isEncrypted(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

/**
 * Encrypt a value with AES-256-GCM under the app key. Idempotent: an
 * already-prefixed value is returned untouched, so backfill jobs that
 * run twice don't double-encrypt.
 *
 * @example
 * ```ts
 * const ciphertext = await encryptValue('123-45-6789')
 * // → 'enc:<iv>:<tag>:<ciphertext>'
 * ```
 */
export async function encryptValue(value: unknown): Promise<unknown> {
  if (value == null) return value
  if (isEncrypted(value)) return value
  // Only strings get encrypted; numbers/booleans/etc. would lose their type
  // through stringification. Callers who need to encrypt a JSON blob should
  // pre-stringify it themselves.
  if (typeof value !== 'string') return value

  const key = await getKey()
  if (!key) {
    log.warn('[orm] encrypted attribute: APP_KEY not set — storing value in plaintext')
    return value
  }

  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)
  const ct = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`
}

/**
 * Decrypt an `enc:`-prefixed value. Plaintext (no prefix) passes through
 * unchanged so the trait works against rows written before the column
 * was marked encrypted.
 *
 * Returns `null` on any decrypt failure (after logging) so a corrupted /
 * key-rotated row doesn't bring down the whole read path.
 *
 * @example
 * ```ts
 * const ssn = await decryptValue(row.ssn) // null if undecryptable
 * ```
 */
export async function decryptValue(value: unknown): Promise<unknown> {
  if (value == null) return value
  if (typeof value !== 'string') return value
  if (!isEncrypted(value)) return value // pre-encryption legacy rows

  try {
    const key = await getKey()
    if (!key) {
      log.warn('[orm] encrypted attribute: APP_KEY not set — cannot decrypt')
      return null
    }
    const [, ivB64, tagB64, ctB64] = value.split(':')
    if (!ivB64 || !tagB64 || !ctB64) {
      log.warn('[orm] encrypted attribute: malformed envelope, returning null')
      return null
    }
    const iv = Buffer.from(ivB64, 'base64')
    const tag = Buffer.from(tagB64, 'base64')
    const ct = Buffer.from(ctB64, 'base64')
    const decipher = createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)
    const pt = Buffer.concat([decipher.update(ct), decipher.final()])
    return pt.toString('utf8')
  }
  catch (err) {
    // GCM auth failures throw here — most commonly because APP_KEY was
    // rotated after the row was written. We log + null instead of throwing
    // so the rest of the read survives; a re-encrypt job can heal these
    // rows on next save.
    log.warn('[orm] encrypted attribute: decrypt failed (key rotation? corrupted ciphertext?)', { error: err })
    return null
  }
}

/**
 * Walk a row's attributes, encrypting each key listed in `encryptedKeys`
 * before write. Mutates a shallow copy of the row, not the original — so
 * caller-side debug dumps still see the plaintext value.
 *
 * @example
 * ```ts
 * const safe = await encryptRowForWrite({ name, ssn: '...' }, ['ssn'])
 * await db.insertInto('users').values(safe).execute()
 * ```
 */
export async function encryptRowForWrite(
  row: Record<string, unknown>,
  encryptedKeys: ReadonlyArray<string>,
): Promise<Record<string, unknown>> {
  if (!row || typeof row !== 'object' || encryptedKeys.length === 0) return row
  const out = { ...row }
  for (const key of encryptedKeys) {
    if (key in out) out[key] = await encryptValue(out[key])
  }
  return out
}

/**
 * Walk a row's attributes, decrypting each key listed in `encryptedKeys`
 * after read. Mirror of `encryptRowForWrite()`.
 *
 * @example
 * ```ts
 * const row = await db.selectFrom('users').selectAll().executeTakeFirst()
 * const decrypted = await decryptRowForRead(row, ['ssn'])
 * ```
 */
export async function decryptRowForRead(
  row: Record<string, unknown>,
  encryptedKeys: ReadonlyArray<string>,
): Promise<Record<string, unknown>> {
  if (!row || typeof row !== 'object' || encryptedKeys.length === 0) return row
  const out = { ...row }
  for (const key of encryptedKeys) {
    if (key in out) out[key] = await decryptValue(out[key])
  }
  return out
}

/**
 * Extract the list of attribute names that have `encrypted: true` from a
 * model definition's `attributes` block. Returns `[]` for models without
 * any encrypted columns so callers don't need to guard.
 *
 * @example
 * ```ts
 * const keys = collectEncryptedAttributes({
 *   attributes: { ssn: { type: 'string', encrypted: true }, name: { type: 'string' } },
 * })
 * // → ['ssn']
 * ```
 */
export function collectEncryptedAttributes(
  definition: { attributes?: Record<string, { encrypted?: boolean } & Record<string, unknown>> },
): string[] {
  const attrs = definition.attributes
  if (!attrs || typeof attrs !== 'object') return []
  const out: string[] = []
  for (const [name, def] of Object.entries(attrs)) {
    if (def && typeof def === 'object' && def.encrypted === true) out.push(name)
  }
  return out
}
