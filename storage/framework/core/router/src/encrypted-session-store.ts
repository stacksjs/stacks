/**
 * Encrypted session store wrapper (stacksjs/stacks#1878 Se-4).
 *
 * Background: bun-router ships four session stores (memory, file,
 * redis, database). Every one of them serializes the session payload
 * via `JSON.stringify` and writes the raw string. A filesystem read,
 * Redis snapshot, or database dump leaks every active session's
 * contents verbatim — credentials, auth tokens, user state. The
 * fingerprinting added in #1860 H-6 is an integrity check (proves
 * the session ID matches the IP/UA pair it was issued for), not
 * encryption-at-rest.
 *
 * Fix: opt-in decorator that wraps any `SessionStore<SessionData>`
 * with AES-GCM via the framework's existing `@stacksjs/security`
 * helpers (600k PBKDF2 iterations per #1866 M-9). On `set`/`touch`:
 * serialize → encrypt → store as a single-key envelope. On `get`:
 * decrypt → deserialize. Other methods (destroy / length / clear)
 * pass through unchanged.
 *
 * @example
 * ```ts
 * import { Session } from '@stacksjs/router'
 * import { EncryptedSessionStore } from '@stacksjs/router'
 * import { RedisSessionStore } from '@stacksjs/router/session'
 *
 * // Wrap any underlying store. The session middleware sees a
 * // standard SessionStore<SessionData> interface; encryption is
 * // transparent to consumers.
 * const session = new Session({
 *   store: new EncryptedSessionStore(
 *     new RedisSessionStore(client),
 *     { appKey: process.env.APP_KEY! },
 *   ),
 * })
 * ```
 */

import type { SessionData, SessionStore } from '@stacksjs/bun-router'
import { decrypt, encrypt } from '@stacksjs/security'

/**
 * Envelope shape persisted to the underlying store. The `_enc`
 * marker means "this entry holds ciphertext, not a plaintext
 * payload" — useful for forward-compat (a future version might
 * add other envelope shapes alongside `_enc`).
 *
 * The `id` field stays plaintext because callers (and the session
 * middleware itself) need to read it to verify the session
 * matches the cookie's SID without paying the decrypt cost.
 */
interface EncryptedEnvelope {
  /** Marker byte indicating this is an encrypted envelope. */
  _enc: true
  /** The session ID (plaintext, used by middleware for SID-match). */
  id?: string
  /** AES-GCM ciphertext of the JSON-stringified payload. */
  data: string
}

export interface EncryptedSessionStoreOptions {
  /**
   * Override the encryption passphrase. Defaults to the global
   * APP_KEY via `@stacksjs/security`. Passed through to the
   * security package's encrypt/decrypt helpers as `customPassphrase`.
   */
  appKey?: string
}

/**
 * Wrap a bun-router `SessionStore<SessionData>` so all writes are
 * encrypted on the way in and decrypted on the way out. Drop-in
 * replacement for any of the built-in stores.
 */
export class EncryptedSessionStore implements SessionStore<SessionData> {
  constructor(
    private readonly inner: SessionStore<SessionData>,
    private readonly opts: EncryptedSessionStoreOptions = {},
  ) {}

  /**
   * Encrypt the payload and forward to the underlying store. We
   * persist the envelope under the same SID so the wrapper is
   * symmetric — no separate ciphertext store or index needed.
   */
  async set(sid: string, session: SessionData, ttl?: number): Promise<void> {
    const envelope = await this.wrap(sid, session)
    await this.inner.set(sid, envelope as unknown as SessionData, ttl)
  }

  async touch(sid: string, session: SessionData, ttl?: number): Promise<void> {
    const envelope = await this.wrap(sid, session)
    await this.inner.touch(sid, envelope as unknown as SessionData, ttl)
  }

  /**
   * Read + decrypt. Returns null for missing sessions (matches the
   * inner store's contract) and ALSO returns null for entries that
   * fail to decrypt — corrupted ciphertext is treated as "session
   * doesn't exist" so a broken row from a partial APP_KEY rotation
   * doesn't crash every request. Errors are logged once per call
   * via the underlying security package's decrypt-side handling.
   */
  async get(sid: string): Promise<SessionData | null> {
    const stored = await this.inner.get(sid)
    if (!stored) return null
    return this.unwrap(stored)
  }

  destroy(sid: string): Promise<void> {
    return this.inner.destroy(sid)
  }

  async all(): Promise<Record<string, SessionData>> {
    const wrapped = await this.inner.all()
    const out: Record<string, SessionData> = {}
    for (const [sid, envelope] of Object.entries(wrapped)) {
      const decrypted = await this.unwrap(envelope)
      if (decrypted) out[sid] = decrypted
    }
    return out
  }

  length(): Promise<number> {
    return this.inner.length()
  }

  clear(): Promise<void> {
    return this.inner.clear()
  }

  // ---- Internal helpers ----

  /**
   * Convert a `SessionData` to the ciphertext envelope.
   */
  private async wrap(sid: string, session: SessionData): Promise<EncryptedEnvelope> {
    // Don't encrypt the `id` field — middleware reads it back without
    // decrypting (for SID-match) and the value is already in the URL/cookie.
    const { id, ...rest } = session
    const ciphertext = await encrypt(JSON.stringify(rest), this.opts.appKey)
    return {
      _enc: true,
      id: id ?? sid,
      data: ciphertext,
    }
  }

  /**
   * Inverse of `wrap`. Tolerates two non-encrypted entry shapes for
   * migration: (a) a payload that was written by the unwrapped store
   * before the wrapper was installed (raw SessionData with no `_enc`
   * marker), and (b) an envelope whose decrypt fails (corrupted or
   * post-rotation key mismatch). Both fall back to null so the
   * caller treats it as "no session" and starts a fresh one — better
   * than throwing every request through the session middleware.
   */
  private async unwrap(stored: unknown): Promise<SessionData | null> {
    if (!stored || typeof stored !== 'object') return null
    const candidate = stored as Partial<EncryptedEnvelope> & SessionData

    if (candidate._enc === true && typeof candidate.data === 'string') {
      try {
        const decrypted = await decrypt(candidate.data, this.opts.appKey)
        const parsed = JSON.parse(decrypted) as SessionData
        if (candidate.id !== undefined) parsed.id = candidate.id
        return parsed
      }
      catch {
        // Decrypt or parse failed — treat as missing session.
        return null
      }
    }

    // Pre-wrapper migration path: row was written without encryption.
    // Return it as-is so the next `set()` writes the encrypted form.
    return candidate as SessionData
  }
}
