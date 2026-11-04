import { config } from '@stacksjs/config'
import { db, getDatabaseDialect, parseSqlDateTime, sqlDateTime } from '@stacksjs/database/runtime'
import { HttpError } from '@stacksjs/error-handling'
import { getCurrentRequest } from '@stacksjs/router'
import { authCookie, authCookieToken } from './cookie'
import { readRequestFingerprint, sessionLogout } from './session-auth'
import { browserSessionIdentifier, createBrowserSessionCredential } from './session-credential'
import { findToken, parseScopes, revokeToken, revokeTokenById } from './tokens'

export { browserSessionIdentifier } from './session-credential'

export interface IssuedBrowserSession {
  /** Plaintext is returned once, only to serialize an HttpOnly cookie. */
  sessionId: string
  /** Safe to expose on the owner's session-management page. Never a credential. */
  identifier: string
  expiresIn: number
  expiresAt: string
}

function userIdentifier(userId: unknown): asserts userId is number {
  if (typeof userId !== 'number' || !Number.isSafeInteger(userId) || userId <= 0)
    throw new TypeError('[auth] Browser sessions require a positive integer user id.')
}

/**
 * Finish a verified browser sign-in with a durable, hashed session credential.
 * Call only from the server's completed password/MFA/SSO issuance path. This is
 * not a public bearer-to-session exchange endpoint. API clients keep their
 * existing short-lived token/refresh contract.
 *
 * The one-use sign-in token and its refresh partner are revoked in the same
 * transaction. The browser receives no refresh secret and normal reads never
 * rotate cookies or extend this session's absolute deadline.
 */
export async function startBrowserSession(
  signInToken: string,
  options: { lifetimeMs?: number, previousSession?: string, previousAccessToken?: string, fingerprint?: { ip?: string | null, userAgent?: string | null } } = {},
): Promise<IssuedBrowserSession | null> {
  const lifetime = options.lifetimeMs ?? config.auth?.session?.lifetime ?? 24 * 60 * 60 * 1000
  if (!Number.isFinite(lifetime) || lifetime < 1000)
    throw new TypeError('[auth] Database browser-session lifetime must be at least one second in milliseconds.')
  const observed = await findToken(signInToken)
  if (!observed || observed.subjectType !== 'users' || observed.grantId || !observed.scopes.includes('*'))
    return null
  const userId = observed.subjectId
  userIdentifier(userId)
  const { Auth } = await import('./authentication')
  const request = getCurrentRequest()
  const previousSession = options.previousSession ?? (request ? authCookieToken(request, { name: 'session_id' }) : undefined)
  const previousAccessToken = options.previousAccessToken ?? (request ? authCookieToken(request) : undefined)

  return db.transaction(async () => {
    let ownerQuery = db.primary.selectFrom('users').where('id', '=', userId).select('id')
    if (getDatabaseDialect() !== 'sqlite') ownerQuery = ownerQuery.lockForUpdate()
    if (!await ownerQuery.executeTakeFirst()) return null

    // Re-read after taking the credential owner's lock. A password change or
    // logout which won that lock must not be followed by fresh browser access.
    const current = await findToken(signInToken)
    if (!current || current.id !== observed.id || current.subjectId !== userId
      || current.subjectType !== 'users' || current.grantId || !current.scopes.includes('*')
      || !await Auth.validateToken(signInToken)) return null

    const sessionId = createBrowserSessionCredential()
    const identifier = browserSessionIdentifier(sessionId)!
    const createdAt = new Date()
    const expiresAt = new Date(createdAt.getTime() + lifetime)
    if (getDatabaseDialect() === 'mysql') expiresAt.setUTCMilliseconds(0)
    const expiresIn = Math.floor((expiresAt.getTime() - Date.now()) / 1000)
    if (!Number.isSafeInteger(expiresIn) || expiresIn < 1)
      throw new TypeError('[auth] Browser-session lifetime cannot be represented by this database and cookie.')
    const fingerprint = readRequestFingerprint(options.fingerprint)
    await db.insertInto('auth_browser_sessions').values({
      id: identifier,
      user_id: userId,
      ip_address: fingerprint.ip,
      user_agent: fingerprint.userAgent,
      payload: JSON.stringify({ browserSession: 1, createdAt: createdAt.toISOString() }),
      last_activity: Math.floor(createdAt.getTime() / 1000),
      expires_at: sqlDateTime(expiresAt),
    }).execute()
    const saved = await db.primary.selectFrom('auth_browser_sessions').where('id', '=', identifier)
      .select(['user_id', 'expires_at']).executeTakeFirst()
    if (!saved || Number(saved.user_id) !== userId
      || parseSqlDateTime(saved.expires_at)?.getTime() !== expiresAt.getTime()
      || expiresAt.getTime() <= Date.now())
      throw new HttpError(500, 'The browser session could not be persisted.')
    await revokeToken(signInToken)
    if (await findToken(signInToken))
      throw new HttpError(500, 'The sign-in credential could not be retired.')
    if (previousAccessToken && previousAccessToken !== signInToken) await revokeToken(previousAccessToken)
    if (previousSession) await sessionLogout(previousSession)
    Auth.clearState()
    return { sessionId, identifier, expiresIn, expiresAt: expiresAt.toISOString() }
  })
}

export function browserSessionCookie(session: IssuedBrowserSession): string {
  if (browserSessionIdentifier(session.sessionId) !== session.identifier)
    throw new TypeError('[auth] Invalid issued browser session.')
  return authCookie(session.sessionId, { name: 'session_id', maxAge: session.expiresIn })
}

export function clearedBrowserSessionCookie(): string {
  return authCookie('', { name: 'session_id', maxAge: 0 })
}

export interface BrowserSessionDescription {
  id: string
  current: boolean
  userAgent: string | null
  ipAddress: string | null
  createdAt: string | null
  lastSeenAt: string | null
  expiresAt: string | null
}

/** Owner-scoped metadata. Saved identifiers cannot be replayed as cookies. */
export async function browserSessions(userId: number, currentCredential = ''): Promise<BrowserSessionDescription[]> {
  userIdentifier(userId)
  const current = browserSessionIdentifier(currentCredential)
  let query = db.primary.selectFrom('auth_browser_sessions').where('user_id', '=', userId)
    .where('id', 'like', 'bs1:%').where('expires_at', '>', sqlDateTime(new Date()))
  const idle = config.auth?.idleTimeout ?? 0
  if (idle > 0) query = query.where('last_activity', '>=', Math.ceil((Date.now() - idle) / 1000))
  const rows = await query.select(['id', 'user_agent', 'ip_address', 'payload', 'last_activity', 'expires_at'])
    .orderBy('last_activity', 'desc').execute()
  const descriptions = rows.flatMap((row) => {
    const expires = parseSqlDateTime(row.expires_at)
    if (!expires || expires.getTime() <= Date.now()) return []
    let createdAt: string | null = null
    try { createdAt = JSON.parse(String(row.payload)).createdAt ?? null }
    catch { /* A legacy payload carries no creation timestamp. */ }
    return [{
      id: String(row.id), current: row.id === current,
      userAgent: row.user_agent == null ? null : String(row.user_agent),
      ipAddress: row.ip_address == null ? null : String(row.ip_address),
      createdAt, lastSeenAt: new Date(Number(row.last_activity) * 1000).toISOString(),
      expiresAt: expires.toISOString(),
    }]
  })
  // Keep existing ordinary web/API sign-ins visible during transport migration.
  // Never list a delegated or limited token as full browser authority.
  const legacyCurrent = !current && currentCredential ? await findToken(currentCredential) : null
  const legacy = await db.primary.selectFrom('oauth_access_tokens')
    .where('tokenable_type', '=', 'users').where('tokenable_id', '=', userId)
    .where('revoked', '=', false).whereNull('oauth_grant_id')
    .select(['id', 'scopes', 'user_agent', 'ip_address', 'created_at', 'updated_at', 'expires_at']).execute()
  const legacyDescriptions: BrowserSessionDescription[] = legacy.flatMap((row) => {
    const id = Number(row.id)
    const expires = row.expires_at == null ? null : parseSqlDateTime(row.expires_at)
    const created = parseSqlDateTime(row.created_at)
    const seen = parseSqlDateTime(row.updated_at ?? row.created_at)
    if (!Number.isSafeInteger(id) || id <= 0 || !parseScopes(row.scopes).includes('*')
      || (row.expires_at != null && (!expires || expires.getTime() <= Date.now()))
      || (idle > 0 && seen && Date.now() - seen.getTime() > idle)) return []
    return [{
      id: `access:${id}`, current: legacyCurrent?.id === id && legacyCurrent.subjectId === userId,
      userAgent: row.user_agent == null ? null : String(row.user_agent),
      ipAddress: row.ip_address == null ? null : String(row.ip_address),
      createdAt: created?.toISOString() ?? null, lastSeenAt: seen?.toISOString() ?? null,
      expiresAt: expires?.toISOString() ?? null,
    }]
  })
  return [...descriptions, ...legacyDescriptions].sort((left, right) =>
    (Date.parse(right.lastSeenAt ?? right.createdAt ?? '') || 0) - (Date.parse(left.lastSeenAt ?? left.createdAt ?? '') || 0))
}

/** Revoke a displayed identifier only within the authenticated owner's scope. */
export async function revokeBrowserSession(userId: number, identifier: string): Promise<void> {
  userIdentifier(userId)
  const legacyId = /^access:([1-9]\d*)$/.exec(identifier)
  if (legacyId) {
    const id = Number(legacyId[1])
    if (!Number.isSafeInteger(id)) return
    await db.transaction(async () => {
      let query = db.primary.selectFrom('oauth_access_tokens')
        .where('id', '=', id).where('tokenable_type', '=', 'users').where('tokenable_id', '=', userId)
        .whereNull('oauth_grant_id').select(['id', 'scopes'])
      if (getDatabaseDialect() !== 'sqlite') query = query.lockForUpdate()
      const token = await query.executeTakeFirst()
      if (token && parseScopes(token.scopes).includes('*')) await revokeTokenById(id)
    })
    return
  }
  if (!/^bs1:[a-f0-9]{64}$/.test(identifier)) return
  await db.transaction(async () => {
    await db.deleteFrom('auth_browser_sessions').where('user_id', '=', userId).where('id', '=', identifier).execute()
    if (await db.primary.selectFrom('auth_browser_sessions').where('user_id', '=', userId).where('id', '=', identifier).select('id').executeTakeFirst())
      throw new HttpError(500, 'The browser session could not be revoked.')
  })
}
