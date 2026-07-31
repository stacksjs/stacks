import { createHash, randomBytes } from 'node:crypto'

export const TEAM_MEMBER_ROLES = ['owner', 'admin', 'member', 'viewer'] as const
export const TEAM_INVITATION_ROLES = ['admin', 'member', 'viewer'] as const

export type TeamMemberRole = typeof TEAM_MEMBER_ROLES[number]
export type TeamInvitationRole = typeof TEAM_INVITATION_ROLES[number]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function parsePositiveId(value: unknown): number | null {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

export function changedRows(result: unknown): number {
  const row = Array.isArray(result) ? result[0] : result
  if (!row || typeof row !== 'object')
    return 0

  const record = row as Record<string, unknown>
  return Number(
    record.changes
    ?? record.affectedRows
    ?? record.numAffectedRows
    ?? record.numUpdatedRows
    ?? 0,
  )
}

export function normalizeInvitationEmail(value: unknown): string | null {
  if (typeof value !== 'string')
    return null

  const email = value.trim().toLowerCase()
  return email.length <= 320 && EMAIL_RE.test(email) ? email : null
}

export function normalizeInvitationRole(value: unknown): TeamInvitationRole | null {
  if (typeof value !== 'string')
    return null

  const role = value.trim().toLowerCase()
  return TEAM_INVITATION_ROLES.includes(role as TeamInvitationRole)
    ? role as TeamInvitationRole
    : null
}

export function generateInvitationToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function sqlTimestamp(value: Date = new Date()): string {
  return value.toISOString().slice(0, 19).replace('T', ' ')
}

export function invitationExpiresAt(now: Date = new Date(), days = 7): string {
  return sqlTimestamp(new Date(now.getTime() + days * 24 * 60 * 60 * 1000))
}

export function invitationStatus(status: unknown, expiresAt: unknown, now: Date = new Date()): string {
  const value = String(status || 'pending')
  if (value !== 'pending')
    return value

  const expires = new Date(String(expiresAt || '').replace(' ', 'T'))
  return Number.isNaN(expires.getTime()) || expires.getTime() > now.getTime()
    ? value
    : 'expired'
}

export function invitationUrl(baseUrl: string, token: string): string {
  const normalizedBase = baseUrl.trim().replace(/\/$/, '')
  return `${normalizedBase}/team-invitations/${encodeURIComponent(token)}`
}
