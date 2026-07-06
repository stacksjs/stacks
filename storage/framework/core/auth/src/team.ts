import { config } from '@stacksjs/config'
import { db } from '@stacksjs/database'
import { Auth } from './authentication'
import { sessionUser } from './session-auth'

/**
 * Team resolution from a request's real auth credential (bearer token or
 * session cookie) — never from a client-supplied form field. Extracted
 * from app-land (stacksjs/status config/auth-team.ts) because every app
 * with team-scoped dashboard forms needs exactly this, and `config/` is
 * for autoloaded config files, not shared helpers.
 *
 * Structural request type on purpose: callers pass whatever request
 * object their action received. Partial objects (tests, non-HTTP
 * callers) resolve to "unauthenticated" rather than crashing.
 */
export interface TeamAuthRequest {
  bearerToken?: () => string | null | undefined
  cookies?: { get: (name: string) => string | null | undefined }
}

export interface TeamMembershipResult {
  teamId: number
  role: string
}

/**
 * Resolve the requesting user's active team membership (team id + role)
 * from their auth credential. Driver-aware: reads config/auth.ts's
 * configured guard driver rather than hardcoding a validation scheme.
 *
 * Dashboard forms are plain HTML POSTs (no client JS, no Authorization
 * header) — the browser only ever sends the auth cookie set on login,
 * so that's checked for the 'token' driver alongside a bearer-header
 * fallback for JS/API callers.
 *
 * Owner membership wins over admin, which wins over any other active
 * membership, when a user belongs to more than one team — the same
 * precedence server-rendered dashboard pages use, so a user never sees
 * a different "current team" between the page that rendered a form and
 * the action that form posts to.
 *
 * Returns `null` when unauthenticated or without an active team
 * membership — callers must treat that as "reject the request," not
 * "fall back to a default team."
 */
export async function resolveAuthenticatedMembership(request: TeamAuthRequest): Promise<TeamMembershipResult | null> {
  const user = await resolveAuthenticatedUser(request)

  if (!user?.id)
    return null

  const memberships = await db
    .selectFrom('team_members')
    .where('user_id', '=', user.id)
    .where('status', '=', 'active')
    .select(['team_id', 'role'])
    .execute()

  if (memberships.length === 0)
    return null

  const owner = memberships.find(m => m.role === 'owner')
  const admin = memberships.find(m => m.role === 'admin')
  const active = owner ?? admin ?? memberships[0]

  return { teamId: Number(active.team_id), role: String(active.role) }
}

/**
 * Team id only — the common case for actions that just need to scope a
 * write to the requester's team. See {@link resolveAuthenticatedMembership}
 * when the caller also needs the role (e.g. owner/admin-only settings).
 */
export async function resolveAuthenticatedTeamId(request: TeamAuthRequest): Promise<number | null> {
  const membership = await resolveAuthenticatedMembership(request)
  return membership ? membership.teamId : null
}

/**
 * The authenticated USER (not team) from a request's real auth
 * credential — bearer header first, then the login cookie, driver-aware
 * like {@link resolveAuthenticatedMembership} (which builds on this).
 * For dashboard form actions that operate on the requester themselves
 * (security settings, profile) rather than on team-scoped rows: plain
 * HTML POSTs carry no Authorization header, so `request.user()` (stamped
 * by the auth middleware from a bearer/session) is undefined there and
 * the login cookie is the only credential available.
 */
export async function resolveAuthenticatedUser(request: TeamAuthRequest): Promise<{ id: number, email?: string } | undefined> {
  const guardName = config.auth?.default || 'api'
  const guard = config.auth?.guards?.[guardName] || { driver: 'token' }
  const driver = guard.driver || 'token'

  const user = driver === 'session'
    ? await resolveSessionUser(request)
    : await resolveTokenUser(request)

  return user?.id ? user as { id: number, email?: string } : undefined
}

async function resolveSessionUser(request: TeamAuthRequest) {
  const sessionId = request.cookies?.get('session_id')
  if (!sessionId)
    return undefined

  return sessionUser(sessionId)
}

async function resolveTokenUser(request: TeamAuthRequest) {
  const cookieName = config.auth?.defaultTokenName || 'auth-token'
  // Guard the bearerToken() call: partial request objects must resolve
  // to "unauthenticated", not crash the auth path.
  const bearer = (typeof request.bearerToken === 'function' ? request.bearerToken() : undefined)
    ?? request.cookies?.get(cookieName)
  if (!bearer)
    return undefined

  return Auth.getUserFromToken(bearer)
}
