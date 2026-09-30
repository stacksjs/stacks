import type { ResolvedOAuthProviderConfig } from './oauth-provider'
import type { OAuthIntrospectionRequest } from './oauth-token-request'
import { createHash } from 'node:crypto'
import { db, getDatabaseDialect, parseSqlDateTime, sqlHelpers } from '@stacksjs/database/runtime'
import { withAuthenticatedOAuthTokenClient } from './oauth-client-registration'

export interface OAuthIntrospectionEndpointInput {
  provider: ResolvedOAuthProviderConfig
  request: OAuthIntrospectionRequest
}

export interface OAuthIntrospectionInactive {
  active: false
}

export interface OAuthIntrospectionActive {
  active: true
  clientId: string
  subject: string
  scope: string
  tokenType: 'Bearer' | 'refresh_token'
  audience: string[]
  issuedAt: number
  expiresAt: number
  issuer: string
  workspaceId: string | null
}

export type OAuthIntrospectionResult = OAuthIntrospectionInactive | OAuthIntrospectionActive

interface StoredIntrospectionToken {
  tokenable_type: string
  tokenable_id: number | string
  oauth_client_id: number | string
  oauth_grant_id: string | null
  scopes: string | null
  resources: string | null
  audiences: string | null
  workspace_id: string | null
  revoked: boolean | number
  expires_at: string | Date | null
  created_at: string | Date | null
  grant_revoked_at: string | Date | null
  grant_client_id: number | string | null
  grant_subject_type: string | null
  grant_subject_id: number | string | null
  client_revoked: boolean | number
  refresh_revoked?: boolean | number
  refresh_expires_at?: string | Date | null
}

const inactive: OAuthIntrospectionInactive = { active: false }

function tokenHash(value: string): string {
  return createHash('sha256').update(value, 'ascii').digest('hex')
}

function activeFlag(value: boolean | number | undefined): boolean {
  return value === false || value === 0
}

function storedValues(value: string | null): string[] | null {
  if (value == null) return null
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) && parsed.every(item => typeof item === 'string')
      ? parsed
      : null
  }
  catch {
    return null
  }
}

function epochSeconds(value: string | Date | null): number | null {
  const parsed = parseSqlDateTime(value)
  if (!parsed || !Number.isSafeInteger(parsed.getTime())) return null
  return Math.floor(parsed.getTime() / 1000)
}

async function loadToken(
  request: OAuthIntrospectionRequest,
): Promise<{ row: StoredIntrospectionToken, tokenType: 'Bearer' | 'refresh_token' } | null> {
  if (!/^[a-f0-9]{80}$/.test(request.token)) return null

  const sql = sqlHelpers(getDatabaseDialect())
  const hash = tokenHash(request.token)
  const access = `
    SELECT a.tokenable_type, a.tokenable_id, a.oauth_client_id, a.oauth_grant_id,
      a.scopes, a.resources, a.audiences, a.workspace_id, a.revoked,
      a.expires_at, a.created_at, g.revoked_at AS grant_revoked_at,
      g.client_id AS grant_client_id, g.subject_type AS grant_subject_type,
      g.subject_id AS grant_subject_id, c.revoked AS client_revoked
    FROM oauth_access_tokens a
    LEFT JOIN oauth_grants g ON g.id = a.oauth_grant_id
    LEFT JOIN oauth_clients c ON c.id = a.oauth_client_id
    WHERE a.token = ${sql.param(1)} AND a.oauth_grant_id IS NOT NULL
    LIMIT 1
  `
  const refresh = `
    SELECT a.tokenable_type, a.tokenable_id, a.oauth_client_id, a.oauth_grant_id,
      a.scopes, a.resources, a.audiences, a.workspace_id,
      a.revoked, a.expires_at, a.created_at,
      g.revoked_at AS grant_revoked_at, g.client_id AS grant_client_id,
      g.subject_type AS grant_subject_type, g.subject_id AS grant_subject_id,
      c.revoked AS client_revoked, r.revoked AS refresh_revoked,
      r.expires_at AS refresh_expires_at
    FROM oauth_refresh_tokens r
    JOIN oauth_access_tokens a ON a.id = r.access_token_id
    LEFT JOIN oauth_grants g ON g.id = a.oauth_grant_id
    LEFT JOIN oauth_clients c ON c.id = a.oauth_client_id
    WHERE r.token = ${sql.param(1)} AND a.oauth_grant_id IS NOT NULL
    LIMIT 1
  `
  const load = async (query: string): Promise<StoredIntrospectionToken | undefined> => {
    const rows = await db.primary.unsafe(query, [hash]) as unknown as StoredIntrospectionToken[]
    return rows[0]
  }

  if (request.tokenTypeHint === 'refresh_token') {
    const row = await load(refresh)
    return row ? { row, tokenType: 'refresh_token' } : null
  }
  if (request.tokenTypeHint === 'access_token') {
    const row = await load(access)
    return row ? { row, tokenType: 'Bearer' } : null
  }
  const accessRow = await load(access)
  if (accessRow) return { row: accessRow, tokenType: 'Bearer' }
  const refreshRow = await load(refresh)
  return refreshRow ? { row: refreshRow, tokenType: 'refresh_token' } : null
}

/** Introspect a delegated token only for a confidential resource server that shares its resource. */
export async function introspectOAuthToken(
  input: OAuthIntrospectionEndpointInput,
): Promise<OAuthIntrospectionResult> {
  const authenticated = await withAuthenticatedOAuthTokenClient(
    String(input.request.clientId),
    input.request.clientSecret,
    async (client) => {
      if (!input.provider.introspection || client.type !== 'confidential')
        return inactive

      const loaded = await loadToken(input.request)
      if (!loaded) return inactive
      const { row, tokenType } = loaded
      const scopes = storedValues(row.scopes)
      const resources = storedValues(row.resources)
      const audiences = storedValues(row.audiences)
      const issuedAt = epochSeconds(row.created_at)
      const expiresAt = epochSeconds(tokenType === 'refresh_token' ? row.refresh_expires_at ?? null : row.expires_at)
      const clientId = Number(row.oauth_client_id)
      const subjectId = Number(row.tokenable_id)
      if (!activeFlag(row.revoked)
        || !activeFlag(row.client_revoked)
        || row.grant_revoked_at != null
        || row.grant_client_id == null
        || String(row.grant_client_id) !== String(row.oauth_client_id)
        || row.grant_subject_type !== row.tokenable_type
        || String(row.grant_subject_id) !== String(row.tokenable_id)
        || !scopes?.length
        || new Set(scopes).size !== scopes.length
        || !resources
        || !audiences
        || resources.length !== audiences.length
        || !Number.isSafeInteger(clientId) || clientId <= 0
        || !Number.isSafeInteger(subjectId) || subjectId <= 0
        || issuedAt == null || expiresAt == null || expiresAt <= Math.floor(Date.now() / 1000)
        || (tokenType === 'refresh_token' && !activeFlag(row.refresh_revoked))
        || !client.resources.some(resource => resources.includes(resource)))
        return inactive

      return {
        active: true,
        clientId: String(clientId),
        subject: `${row.tokenable_type}:${subjectId}`,
        scope: scopes.join(' '),
        tokenType,
        audience: audiences,
        issuedAt,
        expiresAt,
        issuer: input.provider.issuer,
        workspaceId: row.workspace_id,
      }
    },
  )
  return authenticated ?? inactive
}
