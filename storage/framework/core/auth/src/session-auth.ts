
type UserModel = InstanceType<typeof User>
import { HttpError } from '@stacksjs/error-handling'
import { User } from '@stacksjs/orm'
import { verifyHash } from '@stacksjs/security'

const sessions = new Map<string, { userId: number, expiresAt: number }>()
const MAX_SESSIONS = 10_000
const EVICTION_INTERVAL = 5 * 60 * 1000
let lastEviction = Date.now()

function evictExpiredSessions(): void {
  const now = Date.now()
  if (now - lastEviction < EVICTION_INTERVAL && sessions.size < MAX_SESSIONS)
    return

  lastEviction = now
  for (const [key, value] of sessions) {
    if (value.expiresAt <= now) {
      sessions.delete(key)
    }
  }
}

// Dummy hash for timing-safe comparison when user doesn't exist
const DUMMY_BCRYPT_HASH = '$2b$12$000000000000000000000uGByljkdFkOJRCRiYZGFOAstyLlSgTSW'

function generateSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Authenticate a user via email and password, creating a session.
 * Returns the session ID to be set as a cookie.
 */
export async function sessionLogin(email: string, password: string): Promise<{ user: UserModel, sessionId: string }> {
  evictExpiredSessions()

  const user = await User.where('email', email).first()

  // Always run hash verification to prevent timing-based user enumeration
  const hashToVerify = user?.password || DUMMY_BCRYPT_HASH
  const isValid = await verifyHash(password, hashToVerify)

  if (!isValid || !user) {
    throw new HttpError(401, 'Invalid credentials')
  }

  const sessionId = generateSessionId()
  const expiresAt = Date.now() + (24 * 60 * 60 * 1000) // 24 hours

  sessions.set(sessionId, { userId: user.id!, expiresAt })

  return { user, sessionId }
}

/**
 * Destroy the session for the given session ID.
 */
export function sessionLogout(sessionId: string): void {
  sessions.delete(sessionId)
}

/**
 * Get the authenticated user from a session ID.
 */
export async function sessionUser(sessionId: string): Promise<UserModel | undefined> {
  const session = sessions.get(sessionId)

  if (!session)
    return undefined

  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId)
    return undefined
  }

  return await User.find(session.userId)
}

/**
 * Check if a session is authenticated.
 */
export function sessionCheck(sessionId: string): boolean {
  const session = sessions.get(sessionId)

  if (!session)
    return false

  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId)
    return false
  }

  return true
}

/**
 * Refresh a session's expiry time.
 */
export function sessionRefresh(sessionId: string, ttlMs = 24 * 60 * 60 * 1000): boolean {
  const session = sessions.get(sessionId)

  if (!session)
    return false

  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId)
    return false
  }

  session.expiresAt = Date.now() + ttlMs
  return true
}

export const SessionAuth = {
  login: sessionLogin,
  logout: sessionLogout,
  user: sessionUser,
  check: sessionCheck,
  refresh: sessionRefresh,
}
