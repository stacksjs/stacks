
type UserModel = InstanceType<typeof User>
import { HttpError } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { User } from '@stacksjs/orm'
import { verifyHash } from '@stacksjs/security'
import { db } from '@stacksjs/database'

// Dummy hash for timing-safe comparison when user doesn't exist
const DUMMY_BCRYPT_HASH = '$2b$12$000000000000000000000uGByljkdFkOJRCRiYZGFOAstyLlSgTSW'

function generateSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Authenticate a user via email and password, creating a session.
 * Sessions are persisted to the database so they survive server restarts.
 */
export async function sessionLogin(email: string, password: string): Promise<{ user: UserModel, sessionId: string }> {
  const user = await User.where('email', email).first()

  // Always run hash verification to prevent timing-based user enumeration
  const hashToVerify = user?.password || DUMMY_BCRYPT_HASH
  const isValid = await verifyHash(password, hashToVerify)

  if (!isValid || !user) {
    throw new HttpError(401, 'Invalid credentials')
  }

  const sessionId = generateSessionId()
  const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)) // 24 hours

  log.debug(`[auth] Session created for user#${user.id}`)

  // Persist session to database
  try {
    await db.insertInto('sessions')
      .values({
        id: sessionId,
        user_id: user.id!,
        ip_address: null,
        user_agent: null,
        payload: '{}',
        last_activity: Math.floor(Date.now() / 1000),
        expires_at: expiresAt.toISOString(),
      })
      .execute()
  }
  catch (err) {
    // Sessions table may not exist on a fresh DB — that's fine, fall back to
    // a memory-only session. But surface the actual error so a misconfigured
    // schema (renamed column, wrong driver) doesn't masquerade as
    // "no sessions table" forever.
    log.debug(`[auth] Sessions table not available, session is memory-only. err=${(err as Error).message}`)
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
