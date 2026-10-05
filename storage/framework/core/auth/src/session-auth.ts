type UserModel = NonNullable<Awaited<ReturnType<typeof User.find>>>
import { HttpError } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { User } from '@stacksjs/orm'
import { verifyHash } from '@stacksjs/security'
import { config } from '@stacksjs/config'
import { db, getDatabaseDialect, parseSqlDateTime, sqlDateTime } from '@stacksjs/database/runtime'
import { clientAddress, getCurrentRequest } from '@stacksjs/router'
import { DUMMY_BCRYPT_HASH } from './internal-constants'
import { findAuthUserByEmail, normalizeAuthEmail } from './credential-user'
import { RateLimiter } from './rate-limiter'
import { withVerifiedPassword } from './credential-version'
import { schedulePasswordRehash } from './password-rehash'

function generateSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Read the active request's IP + User-Agent for session fingerprinting.
 * Returns nulls when called outside a request scope.
 *
 * The previous implementation hardcoded both fields to `null`,
 * defeating hijack detection (a stolen sessionId from a coffee-shop
 * laptop is indistinguishable from the legitimate owner without
 * IP/UA fingerprints to compare against). See
 * stacksjs/stacks#1860 H-6.
 */
export function readRequestFingerprint(
  override?: { ip?: string | null, userAgent?: string | null },
): { ip: string | null, userAgent: string | null, inRequest?: boolean } {
  if (override) {
    return {
      ip: override.ip ?? null,
      userAgent: override.userAgent ?? null,
    }
  }
  const req = getCurrentRequest()
  if (!req) return { ip: null, userAgent: null, inRequest: false }

  // The address trusted proxies vouch for (`clientAddress()`). This read the
  // first `X-Forwarded-For` entry, which the client writes: whoever held a
  // stolen session id could name the owner's address and pass the IP check
  // that exists to stop them.
  const headers = req.headers
  const ip = clientAddress(req as Request)
  const userAgent = headers?.get?.('user-agent') || headers?.get?.('User-Agent') || null
  return { ip, userAgent, inRequest: true }
}

/**
 * Decide whether a stored session must be rejected because its captured
 * fingerprint no longer matches the current request (basic hijack detection,
 * stacksjs/stacks#1985 — H-6 stored these fields but never compared them).
 *
 * OFF by default: a legitimately changing client IP (mobile/VPN) would
 * otherwise lock the real user out. Opt in via
 * `config.auth.session.enforceFingerprint` — `true` enforces both fields, or
 * `{ ip, userAgent }` enforces each independently (userAgent-only is the
 * safest, since it rarely changes for a real user).
 *
 * A session logged in without a value is never compared on that field, and a
 * check outside any request compares nothing. Inside a request, a User-Agent
 * the session stored but the request lacks IS a mismatch: the header is the
 * client's to send or omit, so treating its absence as "nothing to compare"
 * let anyone holding a stolen session id pass the check by leaving it out.
 * A missing address is not, since the client cannot remove its own socket
 * peer - it is missing for every request or none. On mismatch we reject THIS
 * request but leave the session row intact - the real owner (original
 * fingerprint) keeps working; we don't punish them for an attacker's attempt.
 */
export function fingerprintMismatch(
  enforce: boolean | { ip?: boolean, userAgent?: boolean } | undefined | null,
  stored: { ip?: unknown, userAgent?: unknown },
  current: { ip: string | null, userAgent: string | null, inRequest?: boolean },
): boolean {
  if (!enforce)
    return false

  const enforceIp = enforce === true || !!enforce.ip
  const enforceUa = enforce === true || !!enforce.userAgent
  if (!enforceIp && !enforceUa)
    return false

  // A missing stored value (login without headers) is never compared, and
  // neither is anything outside a request. See the doc comment for the one
  // absence that does count: a User-Agent omitted inside a request.
  if (enforceIp && current.ip != null && stored.ip != null && String(stored.ip) !== current.ip)
    return true
  if (enforceUa && stored.userAgent != null && current.userAgent != null && String(stored.userAgent) !== current.userAgent)
    return true
  if (enforceUa && stored.userAgent != null && current.userAgent == null && current.inRequest === true)
    return true

  return false
}

function sessionFingerprintRejected(session: { ip_address?: unknown, user_agent?: unknown }): boolean {
  return fingerprintMismatch(
    config.auth?.session?.enforceFingerprint,
    { ip: session.ip_address, userAgent: session.user_agent },
    readRequestFingerprint(),
  )
}

/**
 * Authenticate a user via email and password, creating a session.
 * Sessions are persisted to the database so they survive server restarts.
 *
 * The `fingerprint` override is mainly for tests; in normal HTTP
 * handling the active request's IP + UA are captured automatically.
 */
export async function sessionLogin(
  email: string,
  password: string,
  fingerprint?: { ip?: string | null, userAgent?: string | null },
): Promise<{ user: UserModel, sessionId: string }> {
  // Per-email brute-force lockout. The token-login path (Auth.attempt) has
  // always gated on RateLimiter; the session path previously did not, leaving
  // it open to unlimited credential stuffing. Mirror that path exactly,
  // including the ordering: check lockout state up front but enforce it only
  // AFTER the unconditional hash below, so a locked-out account and a
  // wrong-password attempt spend the same CPU and can't be told apart by
  // response timing (the lockout-timing oracle, stacksjs/stacks#1860 H-9).
  const normalizedEmail = normalizeAuthEmail(email || '')
  const isRateLimited = await RateLimiter.isRateLimited(normalizedEmail)

  const user = await findAuthUserByEmail(normalizedEmail)

  // Always run hash verification to prevent timing-based user enumeration
  const hashToVerify = user?.password || DUMMY_BCRYPT_HASH
  const isValid = await verifyHash(password, hashToVerify)

  if (isRateLimited)
    throw new HttpError(429, 'Too many login attempts. Please try again later.')

  if (!isValid || !user) {
    await RateLimiter.recordFailedAttempt(normalizedEmail)
    throw new HttpError(401, 'Invalid credentials')
  }

  await RateLimiter.resetAttempts(normalizedEmail)

  const sessionId = generateSessionId()
  const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)) // 24 hours
  // Match renewal's representable deadline; MySQL TIMESTAMP would otherwise
  // round fractional seconds upward and extend the initial session lifetime.
  if (getDatabaseDialect() === 'mysql') expiresAt.setUTCMilliseconds(0)
  const { ip, userAgent } = readRequestFingerprint(fingerprint)

  // Persist session to database. Throw on failure rather than returning
  // an unusable sessionId (the previous code's "fall back to memory-only"
  // path was a lie — there was no in-memory store, so the caller got
  // a session ID that no subsequent `sessionCheck` could resolve and
  // the user appeared logged in for exactly one response).
  // See stacksjs/stacks#1860 H-6.
  let persisted: boolean | null
  try {
    persisted = await withVerifiedPassword(user.id!, hashToVerify, async () => {
      await db.insertInto('sessions')
        .values({
          id: sessionId,
          user_id: user.id!,
          ip_address: ip,
          user_agent: userAgent,
          payload: '{}',
          last_activity: Math.floor(Date.now() / 1000),
          expires_at: sqlDateTime(expiresAt),
        })
        .execute()
      const stored = await db.primary.selectFrom('sessions')
        .where('id', '=', sessionId).select(['user_id', 'expires_at']).executeTakeFirst()
      if (!stored || String(stored.user_id) !== String(user.id)
        || parseSqlDateTime(stored.expires_at)?.getTime() !== expiresAt.getTime()
        || (parseSqlDateTime(stored.expires_at)?.getTime() ?? 0) <= Date.now())
        throw new Error('Session insert did not persist a usable credential for the verified user.')
      return true
    })
  }
  catch (err) {
    log.error(`[auth] Session persistence failed for user#${user.id}: ${(err as Error).message}`)
    throw new HttpError(500, 'Session could not be created. Ensure the `sessions` table exists (run `./buddy migrate`).')
  }
  if (!persisted)
    throw new HttpError(401, 'Invalid credentials')

  schedulePasswordRehash(user.id!, password, hashToVerify)
  log.debug(`[auth] Session created for user#${user.id}`)
  return { user, sessionId }
}

/**
 * Destroy the session for the given session ID.
 */
export async function sessionLogout(sessionId: string): Promise<void> {
  // A failed delete must reach the caller: otherwise a copied cookie remains
  // valid while the user is told they signed out (stacksjs/stacks#2599).
  await db.transaction(async () => {
    await db.deleteFrom('sessions').where('id', '=', sessionId).execute()
    // A trigger can suppress a DELETE without throwing. Check the committed
    // outcome we promise, not merely whether the statement returned normally.
    const remaining = await db.primary.selectFrom('sessions')
      .where('id', '=', sessionId).select('id').executeTakeFirst()
    if (remaining)
      throw new HttpError(500, 'Session could not be destroyed.')
  })
  log.debug('[auth] Session destroyed')
}

/**
 * Destroy every session for a user — the credential-change sweep.
 * Sessions are validated purely on row existence + `expires_at`, never
 * re-checked against the password hash, so without this a stolen
 * session cookie survives a password reset for up to 24h
 * (stacksjs/stacks#1947).
 *
 * Like `sessionLogout`, real failures propagate (fail loud): a reset
 * that reports success while the attacker's session lives would be a
 * lie. A missing `sessions` table alone is a benign no-op — no
 * framework migration creates it (only userland adopting session-auth
 * does), and without the table `sessionCheck` can never validate a
 * session, so there is no credential left to revoke.
 */
export async function sessionDestroyAll(userId: number): Promise<void> {
  try {
    // A transaction also rolls back partial deletes when one row is retained.
    // Its nested savepoint isolates the optional-schema failure on Postgres.
    await db.transaction(async () => {
      await db.deleteFrom('sessions').where('user_id', '=', userId).execute()
      const remaining = await db.primary.selectFrom('sessions')
        .where('user_id', '=', userId).select('id').executeTakeFirst()
      if (remaining)
        throw new HttpError(500, 'Sessions could not be destroyed.')
    })
  }
  catch (err) {
    const message = err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err)
    // sqlite: `no such table: sessions` / postgres: `relation "sessions"
    // does not exist` / mysql: `Table '….sessions' doesn't exist`
    // Match the actual optional table, not a trigger dependency such as
    // audit_sessions: swallowing that error would report a revocation that
    // left the session rows intact.
    if (/^(?:no such table: (?:main\.)?sessions|relation "sessions" does not exist|Table '(?:[^'.]+\.)?sessions' doesn't exist)$/i.test(message))
      return
    throw err
  }
}

/** Delete the observed expired version without removing a concurrent renewal. */
async function deleteObservedExpiredSession(sessionId: string, expiresAt: unknown): Promise<void> {
  const cleanup = db.deleteFrom('sessions').where('id', '=', sessionId)
  await (expiresAt == null
    ? cleanup.whereNull('expires_at')
    : cleanup.where('expires_at', '=', expiresAt)).execute()
}

/** Delete only the orphaned session version whose absent owner we observed. */
async function deleteObservedOrphanedSession(
  sessionId: string,
  userId: number,
  expiresAt: unknown,
): Promise<void> {
  let cleanup = db.deleteFrom('sessions')
    .where('id', '=', sessionId)
    .where('user_id', '=', userId)
  cleanup = expiresAt == null
    ? cleanup.whereNull('expires_at')
    : cleanup.where('expires_at', '=', expiresAt)
  await cleanup.execute()
}

async function sessionOwnerExists(userId: number, lock = false): Promise<boolean> {
  let query = db.primary.selectFrom('users')
    .where('id', '=', userId)
    .select('id')
  if (lock && getDatabaseDialect() !== 'sqlite') query = query.lockForUpdate()
  const owner = await query.executeTakeFirst()
  return owner !== undefined
}

function sessionIdleTimeoutExceeded(lastActivity: unknown): boolean {
  const idleMs = config.auth?.idleTimeout ?? 0
  if (idleMs <= 0)
    return false

  const seconds = Number(lastActivity)
  if (!Number.isFinite(seconds) || seconds <= 0)
    return true
  return Date.now() - seconds * 1000 > idleMs
}

async function deleteObservedIdleSession(sessionId: string, userId: number, expiresAt: unknown, lastActivity: unknown): Promise<void> {
  let cleanup = db.deleteFrom('sessions')
    .where('id', '=', sessionId)
    .where('user_id', '=', userId)
  cleanup = expiresAt == null
    ? cleanup.whereNull('expires_at')
    : cleanup.where('expires_at', '=', expiresAt)
  cleanup = lastActivity == null
    ? cleanup.whereNull('last_activity')
    : cleanup.where('last_activity', '=', lastActivity)
  await cleanup.execute()
}

async function touchSessionActivity(sessionId: string, expiresAt: unknown, lastActivity: unknown): Promise<void> {
  if ((config.auth?.idleTimeout ?? 0) <= 0)
    return

  let touch = db.updateTable('sessions')
    .set({ last_activity: Math.floor(Date.now() / 1000) })
    .where('id', '=', sessionId)
  touch = expiresAt == null ? touch.whereNull('expires_at') : touch.where('expires_at', '=', expiresAt)
  touch = lastActivity == null ? touch.whereNull('last_activity') : touch.where('last_activity', '=', lastActivity)
  await touch.execute()
}

/** Get the authenticated user from a session ID. */
export async function sessionUser(sessionId: string): Promise<UserModel | undefined> {
  try {
    const query = db.primary.selectFrom('sessions').where('id', '=', sessionId)
    const session = config.auth?.session?.enforceFingerprint
      ? await query.select(['user_id', 'expires_at', 'last_activity', 'ip_address', 'user_agent']).executeTakeFirst()
      : await query.select(['user_id', 'expires_at', 'last_activity']).executeTakeFirst()

    if (!session)
      return undefined

    const expiresAt = parseSqlDateTime(session.expires_at)?.getTime() ?? 0
    if (Date.now() >= expiresAt) {
      // Delete only the expired version we read. A concurrent refresh may have
      // renewed this session before the cleanup reaches the database.
      await deleteObservedExpiredSession(sessionId, session.expires_at)
      return undefined
    }

    if (sessionIdleTimeoutExceeded(session.last_activity)) {
      await deleteObservedIdleSession(sessionId, session.user_id as number, session.expires_at, session.last_activity)
      return undefined
    }

    if (sessionFingerprintRejected(session)) {
      log.warn(`[auth] Session fingerprint mismatch - rejecting request (possible hijack, session left intact)`)
      return undefined
    }

    const userId = session.user_id as number
    if (!await sessionOwnerExists(userId)) {
      await deleteObservedOrphanedSession(sessionId, userId, session.expires_at)
      return undefined
    }
    await touchSessionActivity(sessionId, session.expires_at, session.last_activity)
    return await User.find(userId)
  }
  catch {
    // Sessions table may not exist
    return undefined
  }
}

/**
 * Check if a session is authenticated.
 */
export async function sessionCheck(sessionId: string): Promise<boolean> {
  try {
    const query = db.primary.selectFrom('sessions').where('id', '=', sessionId)
    const session = config.auth?.session?.enforceFingerprint
      ? await query.select(['user_id', 'expires_at', 'last_activity', 'ip_address', 'user_agent']).executeTakeFirst()
      : await query.select(['user_id', 'expires_at', 'last_activity']).executeTakeFirst()

    if (!session)
      return false

    const expiresAt = parseSqlDateTime(session.expires_at)?.getTime() ?? 0
    if (Date.now() >= expiresAt) {
      await deleteObservedExpiredSession(sessionId, session.expires_at)
      return false
    }

    if (sessionIdleTimeoutExceeded(session.last_activity)) {
      await deleteObservedIdleSession(sessionId, session.user_id as number, session.expires_at, session.last_activity)
      return false
    }

    if (sessionFingerprintRejected(session))
      return false

    const userId = session.user_id as number
    if (!await sessionOwnerExists(userId)) {
      await deleteObservedOrphanedSession(sessionId, userId, session.expires_at)
      return false
    }

    await touchSessionActivity(sessionId, session.expires_at, session.last_activity)

    return true
  }
  catch {
    return false
  }
}

/**
 * Refresh a session's expiry time.
 * Non-positive or non-finite TTLs are rejected without changing the session.
 */
export async function sessionRefresh(sessionId: string, ttlMs = 24 * 60 * 60 * 1000): Promise<boolean> {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0)
    return false

  try {
    const query = db.primary.selectFrom('sessions').where('id', '=', sessionId)
    const session = config.auth?.session?.enforceFingerprint
      ? await query.select(['user_id', 'expires_at', 'last_activity', 'ip_address', 'user_agent']).executeTakeFirst()
      : await query.select(['user_id', 'expires_at', 'last_activity']).executeTakeFirst()

    if (!session)
      return false

    const expiresAt = parseSqlDateTime(session.expires_at)?.getTime() ?? 0
    if (Date.now() >= expiresAt) {
      await deleteObservedExpiredSession(sessionId, session.expires_at)
      return false
    }

    if (sessionIdleTimeoutExceeded(session.last_activity)) {
      await deleteObservedIdleSession(sessionId, session.user_id as number, session.expires_at, session.last_activity)
      return false
    }

    if (sessionFingerprintRejected(session))
      return false

    return await db.transaction(async () => {
      const mysql = getDatabaseDialect() === 'mysql'
      if (mysql) {
        // MySQL emulates RETURNING with reads. Lock the observed version first
        // so a repeatable-read snapshot cannot report a concurrently deleted
        // or replaced session as an updated row.
        const current = await db.primary.selectFrom('sessions')
          .where('id', '=', sessionId).where('expires_at', '=', session.expires_at)
          .select('id').lockForUpdate().executeTakeFirst()
        if (!current) return false
      }
      const userId = session.user_id as number
      if (!await sessionOwnerExists(userId, true)) {
        await deleteObservedOrphanedSession(sessionId, userId, session.expires_at)
        return false
      }
      const newExpiry = new Date(Date.now() + ttlMs)
      // MySQL's whole-second TIMESTAMP must not round the promised deadline
      // upward. An unrepresentably short TTL must leave the session intact.
      // UTC avoids reinterpreting the repeated local hour at DST fallback.
      if (mysql) newExpiry.setUTCMilliseconds(0)
      if (!Number.isFinite(newExpiry.getTime()) || newExpiry.getTime() <= Date.now())
        return false
      const lastActivity = Math.floor(Date.now() / 1000)
      const result = await db.updateTable('sessions')
        .set({
          expires_at: sqlDateTime(newExpiry),
          last_activity: lastActivity,
        })
        .where('id', '=', sessionId)
        .where('expires_at', '=', session.expires_at)
        .where('user_id', '=', session.user_id)
        .returning('id')
        .executeTakeFirst()

      // Do not revive a session which expired while the UPDATE waited. Throw
      // inside the transaction so its writes roll back before returning false.
      if (Date.now() >= expiresAt || Date.now() >= newExpiry.getTime())
        throw new Error('[auth] Session expired during renewal.')

      // Compare against the observed version: another refresh or expiry
      // change must not be overwritten by this stale reader. Returning a row
      // preserves same-value MySQL refreshes, unlike changed-row counts.
      if (!result) return false

      // RETURNING may be emulated, and a trigger may alter or suppress the
      // update. Verify the actual stored credential before committing it.
      let storedQuery = db.primary.selectFrom('sessions').where('id', '=', sessionId)
        .select(['user_id', 'expires_at', 'last_activity'])
      if (mysql) storedQuery = storedQuery.lockForUpdate()
      const stored = await storedQuery.executeTakeFirst()
      if (!stored || String(stored.user_id) !== String(session.user_id)
        || parseSqlDateTime(stored.expires_at)?.getTime() !== newExpiry.getTime()
        || Number(stored.last_activity) !== lastActivity
        || Date.now() >= Math.min(expiresAt, newExpiry.getTime()))
        throw new Error('[auth] Session renewal did not persist the requested credential.')
      if (!await sessionOwnerExists(userId, true))
        throw new Error('[auth] Session owner disappeared during renewal.')
      return true
    })
  }
  catch {
    return false
  }
}

export const SessionAuth = {
  login: sessionLogin,
  logout: sessionLogout,
  destroyAll: sessionDestroyAll,
  user: sessionUser,
  check: sessionCheck,
  refresh: sessionRefresh,
}
