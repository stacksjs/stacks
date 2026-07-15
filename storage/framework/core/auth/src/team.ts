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

/** A team the authenticated user may switch the dashboard to. */
export interface SwitchableTeam {
  id: number
  name: string
  role: string
}

/** Full dashboard team context — see {@link resolveTeamContext}. */
export interface TeamContext {
  user: any | null
  teamId: number | null
  role: string | null
  teams: SwitchableTeam[]
  activeTeamId: number | null
}

/**
 * Name of the cookie that remembers which team the user last switched the
 * dashboard to (a workspace switcher). It is NOT a security credential: the
 * server re-validates membership against `selectActiveTeam` on every request,
 * so a tampered value can only ever resolve to a team the user already
 * belongs to (or, for operators, any team when `allowAnyTeam` is set).
 */
export const ACTIVE_TEAM_COOKIE = 'active_team'

/**
 * Pure resolver — no I/O — that decides which team is "active" for a user
 * given their memberships and an optional switch preference. Reusable across
 * apps: it encodes the whole workspace-switching precedence in one place.
 *
 * - Honors `activeTeamId` only when the user may access it: a member always
 *   may; a privileged operator may access any team when `allowAnyTeam` is set
 *   (the app decides who is privileged — e.g. a super-admin flag).
 * - Otherwise falls back to the highest-priority membership (owner > admin >
 *   anything else), matching what dashboard pages have always shown, so the
 *   "current team" never differs between a rendered form and the action it
 *   posts to.
 */
export function selectActiveTeam(opts: {
  memberships: Array<{ team_id: number | string, role?: string | null }>
  activeTeamId?: number | null
  allowAnyTeam?: boolean
  rolePriority?: Record<string, number>
}): { teamId: number | null, role: string | null } {
  const priority = opts.rolePriority ?? { owner: 0, admin: 1 }
  const sorted = [...(opts.memberships ?? [])].sort(
    (a, b) => (priority[a.role ?? ''] ?? 2) - (priority[b.role ?? ''] ?? 2),
  )

  const active = opts.activeTeamId == null ? null : Number(opts.activeTeamId)
  if (active != null && Number.isFinite(active)) {
    const member = sorted.find(x => Number(x.team_id) === active)
    if (member)
      return { teamId: active, role: member.role ?? null }
    if (opts.allowAnyTeam)
      return { teamId: active, role: 'admin' }
  }

  const first = sorted[0]
  return first ? { teamId: Number(first.team_id), role: first.role ?? null } : { teamId: null, role: null }
}

/** Read the active-team switch preference from a request's cookie. */
export function getActiveTeamPreference(request: TeamAuthRequest): number | null {
  const raw = request.cookies?.get(ACTIVE_TEAM_COOKIE)
  if (!raw)
    return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Build the `Set-Cookie` that pins the active team (workspace switcher). A
 * year-long HttpOnly cookie: only the server needs it (SSR reads it, the
 * switch action writes it), and it carries no privilege of its own.
 */
export function buildActiveTeamCookie(teamId: number, opts: { maxAgeSeconds?: number, secure?: boolean } = {}): string {
  const maxAge = Math.max(0, Math.floor(opts.maxAgeSeconds ?? 60 * 60 * 24 * 365))
  const parts = [`${ACTIVE_TEAM_COOKIE}=${encodeURIComponent(String(teamId))}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`]
  if (opts.secure)
    parts.push('Secure')
  return parts.join('; ')
}

/** Clear the active-team cookie {@link buildActiveTeamCookie} sets. */
export function clearActiveTeamCookie(): string {
  return `${ACTIVE_TEAM_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
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

  // Honor the workspace switcher: if the user has pinned an active team (and
  // is still a member of it), scope to that; otherwise fall back to the
  // highest-priority membership. All team-scoped actions built on
  // resolveAuthenticatedTeamId therefore follow the switch automatically.
  const picked = selectActiveTeam({
    // Preserve a genuinely null role as null (don't coerce it to the string
    // "null", which is truthy and would pass a bare `if (role)` check).
    memberships: memberships.map((m: any) => ({
      team_id: Number(m.team_id),
      role: m.role == null ? null : String(m.role),
    })),
    activeTeamId: getActiveTeamPreference(request),
  })

  // Use the PICKED team's role, never another team's. The old fallback
  // borrowed `memberships[0].role` — the highest-priority membership, which
  // belongs to a different team — so a user who is owner of team A and a
  // bare member of team B could resolve as "owner" while scoped to B. A
  // genuinely absent role degrades to '' (no elevated privilege) instead.
  // stacksjs/stacks#1985.
  return picked.teamId != null
    ? { teamId: picked.teamId, role: picked.role ?? '' }
    : null
}

/**
 * Full team context for a server-rendered dashboard: the authenticated user,
 * the resolved active team (honoring the workspace switcher), and the list of
 * teams the user can switch between. One call replaces the per-page auth+team
 * boilerplate every dashboard view used to copy, and centralizes the
 * switch-aware scoping so pages and the actions they post to never disagree.
 *
 * `opts.allowAnyTeam(user)` lets an app grant an operator (e.g. a super-admin)
 * access to every team — they can switch to, and see, teams they aren't a
 * member of. The full user row is returned so the app can read its own
 * columns (like a super-admin flag) without a second query.
 */
export async function resolveTeamContext(
  request: TeamAuthRequest,
  opts: { allowAnyTeam?: (user: any) => boolean } = {},
): Promise<TeamContext> {
  const empty: TeamContext = { user: null, teamId: null, role: null, teams: [], activeTeamId: null }

  const guardName = config.auth?.default || 'api'
  const driver = config.auth?.guards?.[guardName]?.driver || 'token'
  const user = driver === 'session' ? await resolveSessionUser(request) : await resolveTokenUser(request)
  if (!user?.id)
    return empty

  const memberships = await db
    .selectFrom('team_members')
    .where('user_id', '=', user.id)
    .where('status', '=', 'active')
    .select(['team_id', 'role'])
    .execute()

  const allowAny = opts.allowAnyTeam ? !!opts.allowAnyTeam(user) : false
  const activeTeamId = getActiveTeamPreference(request)
  const picked = selectActiveTeam({
    memberships: memberships.map((m: any) => ({ team_id: Number(m.team_id), role: String(m.role) })),
    activeTeamId,
    allowAnyTeam: allowAny,
  })

  // Switchable teams: the user's own teams, or every team for an operator.
  const roleByTeam = new Map<number, string>(memberships.map((m: any) => [Number(m.team_id), String(m.role)]))
  let teamRows: Array<{ id: number | string, name: string }> = []
  if (allowAny) {
    teamRows = await db.selectFrom('teams').select(['id', 'name']).execute()
  }
  else {
    const ids = [...roleByTeam.keys()]
    teamRows = ids.length ? await db.selectFrom('teams').whereIn('id', ids).select(['id', 'name']).execute() : []
  }
  const teams: SwitchableTeam[] = teamRows
    .map(t => ({ id: Number(t.id), name: String(t.name), role: roleByTeam.get(Number(t.id)) || 'viewer' }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return { user, teamId: picked.teamId, role: picked.role, teams, activeTeamId }
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
