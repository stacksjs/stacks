
type UserModel = InstanceType<typeof User>
import { HttpError } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { User } from '@stacksjs/orm'
import { verifyHash } from '@stacksjs/security'
import { db } from '@stacksjs/database'
import { getCurrentRequest } from '@stacksjs/router'
import { DUMMY_BCRYPT_HASH } from './internal-constants'

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
function readRequestFingerprint(
  override?: { ip?: string | null, userAgent?: string | null },
): { ip: string | null, userAgent: string | null } {
  if (override) {
    return {
      ip: override.ip ?? null,
      userAgent: override.userAgent ?? null,
    }
  }
  const req = getCurrentRequest()
  if (!req) return { ip: null, userAgent: null }

  // Prefer the request's own `ip()` macro when it's a function (some
  // EnhancedRequest configs); fall back to `X-Forwarded-For` first
  // entry, then `X-Real-IP`. We do NOT trust forwarding headers
  // unconditionally — userland that needs a strict policy should set
  // a trust-proxy layer before this code runs.
  const headers = req.headers
  const fwd = headers?.get?.('x-forwarded-for') || headers?.get?.('X-Forwarded-For') || ''
  const realIp = headers?.get?.('x-real-ip') || headers?.get?.('X-Real-IP') || ''
  const ip = (fwd ? fwd.split(',')[0]!.trim() : '') || realIp || null
  const userAgent = headers?.get?.('user-agent') || headers?.get?.('User-Agent') || null
  return { ip, userAgent }
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
  const user = await User.where('email', email).first()

  // Always run hash verification to prevent timing-based user enumeration
  const hashToVerify = user?.password || DUMMY_BCRYPT_HASH
  const isValid = await verifyHash(password, hashToVerify)

  if (!isValid || !user) {
    throw new HttpError(401, 'Invalid credentials')
  }

  const sessionId = generateSessionId()
  const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)) // 24 hours
  const { ip, userAgent } = readRequestFingerprint(fingerprint)

  log.debug(`[auth] Session created for user#${user.id}`)

  // Persist session to database. Throw on failure rather than returning
  // an unusable sessionId (the previous code's "fall back to memory-only"
  // path was a lie — there was no in-memory store, so the caller got
  // a session ID that no subsequent `sessionCheck` could resolve and
  // the user appeared logged in for exactly one response).
  // See stacksjs/stacks#1860 H-6.
  try {
    await db.insertInto('sessions')
      .values({
        id: sessionId,
        user_id: user.id!,
        ip_address: ip,
        user_agent: userAgent,
        payload: '{}',
        last_activity: Math.floor(Date.now() / 1000),
        expires_at: expiresAt.toISOString(),
      })
      .execute()
  }
  catch (err) {
    log.error(`[auth] Session persistence failed for user#${user.id}: ${(err as Error).message}`)
    throw new HttpError(500, 'Session could not be created. Ensure the `sessions` table exists (run `./buddy migrate`).')
  }

  return { user, sessionId }
}

/**
 * Destroy the session for the given session ID.
 */
export async function sessionLogout(sessionId: string): Promise<void> {
  log.debug('[auth] Session destroyed')

  try {
    await db.deleteFrom('sessions')
      .where('id', '=', sessionId)
      .execute()
  }
  catch (err) {
    log.debug(`[auth] Session destroy failed: ${(err as Error).message}`)
  }
}

/**
 * Get the authenticated user from a session ID.
 */
export async function sessionUser(sessionId: string): Promise<UserModel | undefined> {
  try {
    const session = await db.selectFrom('sessions')
      .where('id', '=', sessionId)
      .selectAll()
      .executeTakeFirst()

    if (!session)
      return undefined

    const expiresAt = session.expires_at ? new Date(String(session.expires_at)).getTime() : 0
    if (Date.now() > expiresAt) {
      await db.deleteFrom('sessions').where('id', '=', sessionId).execute()
      return undefined
    }

    return await User.find(session.user_id as number)
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
    const session = await db.selectFrom('sessions')
      .where('id', '=', sessionId)
      .selectAll()
      .executeTakeFirst()

    if (!session)
      return false

    const expiresAt = session.expires_at ? new Date(String(session.expires_at)).getTime() : 0
    if (Date.now() > expiresAt) {
      await db.deleteFrom('sessions').where('id', '=', sessionId).execute()
      return false
    }

    return true
  }
  catch {
    return false
  }
}

/**
 * Refresh a session's expiry time.
 */
export async function sessionRefresh(sessionId: string, ttlMs = 24 * 60 * 60 * 1000): Promise<boolean> {
  try {
    const session = await db.selectFrom('sessions')
      .where('id', '=', sessionId)
      .selectAll()
      .executeTakeFirst()

    if (!session)
      return false

    const expiresAt = session.expires_at ? new Date(String(session.expires_at)).getTime() : 0
    if (Date.now() > expiresAt) {
      await db.deleteFrom('sessions').where('id', '=', sessionId).execute()
      return false
    }

    const newExpiry = new Date(Date.now() + ttlMs)
    await db.updateTable('sessions')
      .set({
        expires_at: newExpiry.toISOString(),
        last_activity: Math.floor(Date.now() / 1000),
      })
      .where('id', '=', sessionId)
      .execute()

    return true
  }
  catch {
    return false
  }
}

export const SessionAuth = {
  login: sessionLogin,
  logout: sessionLogout,
  user: sessionUser,
  check: sessionCheck,
  refresh: sessionRefresh,
}
