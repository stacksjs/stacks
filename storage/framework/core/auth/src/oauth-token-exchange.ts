import type { AuthorizationCodeRedemption, AuthorizationCodeResult } from './oauth-authorization-codes'
import { createHash, randomBytes } from 'node:crypto'
import {
  db,
  getDatabaseDialect,
  parseSqlDateTime,
  sqlDateTime,
  sqlHelpers,
} from '@stacksjs/database/runtime'
import { withAuthorizationCode } from './oauth-authorization-codes'
import { withAuthenticatedOAuthTokenClient } from './oauth-client-registration'

export interface ExchangeAuthorizationCodeInput extends AuthorizationCodeRedemption {
  code: string
  accessTokenLifetimeMs: number
  refreshTokenLifetimeMs: number
  issueRefreshToken?: boolean
}

export interface ExchangeOAuthAuthorizationCodeInput extends ExchangeAuthorizationCodeInput {
  clientSecret?: string
}

export interface DelegatedTokenPair {
  accessToken: string
  refreshToken?: string
  tokenType: 'Bearer'
  expiresIn: number
  grantId: string
  clientId: number
  subjectType: string
  subjectId: number
  scopes: string[]
  resources: string[]
  audiences: string[]
  workspaceId: string | null
}

interface StoredAccessToken {
  id: number | string
  tokenable_type: string
  tokenable_id: number | string
  oauth_client_id: number | string
  token: string
  scopes: string
  oauth_grant_id: string | null
  resources: string | null
  audiences: string | null
  workspace_id: string | null
  revoked: boolean | number
  expires_at: string | Date
}

interface StoredRefreshToken {
  access_token_id: number | string
  token: string
  family_id: string | null
  parent_id: number | string | null
  revoked: boolean | number
  expires_at: string | Date
}

class InactiveOAuthClientError extends Error {}

const invalidGrant = { ok: false as const, reason: 'invalid_grant' as const }
const invalidClient = { ok: false as const, reason: 'invalid_client' as const }

export type OAuthAuthorizationCodeExchangeResult
  = AuthorizationCodeResult<DelegatedTokenPair>
    | typeof invalidClient

function tokenHash(value: string): string {
  return createHash('sha256').update(value, 'ascii').digest('hex')
}

function validLifetime(lifetimeMs: number): number {
  if (!Number.isSafeInteger(lifetimeMs) || lifetimeMs <= 0)
    throw new TypeError('OAuth token lifetime must be a positive safe integer.')
  return lifetimeMs
}

function deadline(issuedAt: Date, lifetimeMs: number, mysql: boolean): Date {
  const value = new Date(issuedAt.getTime() + lifetimeMs)
  if (!Number.isFinite(value.getTime()))
    throw new TypeError('OAuth token lifetime is outside the supported date range.')
  if (mysql) value.setUTCMilliseconds(0)
  return value
}

function storedValues(value: string | null): string[] | null {
  if (value == null) return null
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) && parsed.every(item => typeof item === 'string') ? parsed : null
  }
  catch {
    return null
  }
}

function activeFlag(value: boolean | number): boolean {
  return value === false || value === 0
}

/** Atomically consume an authorization code and mint its grant-bound token pair. */
export async function exchangeAuthorizationCode(
  input: ExchangeAuthorizationCodeInput,
): Promise<AuthorizationCodeResult<DelegatedTokenPair>> {
  const sql = sqlHelpers(getDatabaseDialect())
  const accessLifetimeMs = validLifetime(input.accessTokenLifetimeMs)
  const issueRefreshToken = input.issueRefreshToken !== false
  const refreshLifetimeMs = issueRefreshToken ? validLifetime(input.refreshTokenLifetimeMs) : 0

  try {
    return await withAuthorizationCode(input.code, input, async (grant) => {
      // Hold the client active through commit. Client revocation then orders
      // before this exchange or waits until the pair is durably issued.
      const clientLock = sql.isPostgres ? ' FOR SHARE' : sql.isMysql ? ' LOCK IN SHARE MODE' : ''
      const clients = await db.unsafe(`
        SELECT id FROM oauth_clients
        WHERE id = ${sql.param(1)} AND revoked = ${sql.boolFalse}
        LIMIT 1${clientLock}
      `, [grant.clientId]) as unknown[]
      if (clients.length !== 1)
        throw new InactiveOAuthClientError()

      const accessToken = randomBytes(40).toString('hex')
      const refreshToken = issueRefreshToken ? randomBytes(40).toString('hex') : undefined
      const refreshFamilyId = refreshToken ? randomBytes(16).toString('hex') : undefined
      const accessHash = tokenHash(accessToken)
      const refreshHash = refreshToken ? tokenHash(refreshToken) : undefined
      const createdAt = new Date()
      if (sql.isMysql) createdAt.setUTCMilliseconds(0)
      const accessExpiresAt = deadline(createdAt, accessLifetimeMs, sql.isMysql)
      const refreshExpiresAt = issueRefreshToken ? deadline(createdAt, refreshLifetimeMs, sql.isMysql) : undefined
      const revoked = sql.isPostgres ? false : 0
      const accessValues = sql.params(
        grant.subjectType,
        grant.subjectId,
        grant.subjectId,
        grant.clientId,
        accessHash,
        `oauth:${grant.grantId}`,
        JSON.stringify(grant.scopes),
        grant.grantId,
        JSON.stringify(grant.resources),
        JSON.stringify(grant.audiences),
        grant.workspaceId,
        revoked,
        sqlDateTime(accessExpiresAt),
        sqlDateTime(createdAt),
        sqlDateTime(createdAt),
      )
      await db.unsafe(`
        INSERT INTO oauth_access_tokens (
          tokenable_type, tokenable_id, user_id, oauth_client_id, token, name, scopes,
          oauth_grant_id, resources, audiences, workspace_id, revoked, expires_at, created_at, updated_at
        ) VALUES (${accessValues.sql})
      `, accessValues.values)

      const accessRows = await db.unsafe(`
        SELECT id, tokenable_type, tokenable_id, oauth_client_id, token, scopes, oauth_grant_id,
          resources, audiences, workspace_id, revoked, expires_at
        FROM oauth_access_tokens WHERE token = ${sql.param(1)} LIMIT 1
      `, [accessHash]) as unknown as StoredAccessToken[]
      const storedAccess = accessRows[0]
      if (!storedAccess
        || storedAccess.tokenable_type !== grant.subjectType
        || String(storedAccess.tokenable_id) !== String(grant.subjectId)
        || String(storedAccess.oauth_client_id) !== String(grant.clientId)
        || storedAccess.oauth_grant_id !== grant.grantId
        || JSON.stringify(storedValues(storedAccess.scopes)) !== JSON.stringify(grant.scopes)
        || JSON.stringify(storedValues(storedAccess.resources)) !== JSON.stringify(grant.resources)
        || JSON.stringify(storedValues(storedAccess.audiences)) !== JSON.stringify(grant.audiences)
        || storedAccess.workspace_id !== grant.workspaceId
        || !activeFlag(storedAccess.revoked)
        || parseSqlDateTime(storedAccess.expires_at)?.getTime() !== accessExpiresAt.getTime())
        throw new Error('Failed to persist the delegated access token.')

      if (refreshToken && refreshHash && refreshExpiresAt) {
        const refreshValues = sql.params(
          Number(storedAccess.id),
          refreshHash,
          refreshFamilyId,
          null,
          revoked,
          sqlDateTime(refreshExpiresAt),
          sqlDateTime(createdAt),
        )
        await db.unsafe(`
          INSERT INTO oauth_refresh_tokens (access_token_id, token, family_id, parent_id, revoked, expires_at, created_at)
          VALUES (${refreshValues.sql})
        `, refreshValues.values)
        const refreshRows = await db.unsafe(`
          SELECT access_token_id, token, family_id, parent_id, revoked, expires_at
          FROM oauth_refresh_tokens WHERE token = ${sql.param(1)} LIMIT 1
        `, [refreshHash]) as unknown as StoredRefreshToken[]
        const storedRefresh = refreshRows[0]
        if (!storedRefresh
          || String(storedRefresh.access_token_id) !== String(storedAccess.id)
          || storedRefresh.family_id !== refreshFamilyId
          || storedRefresh.parent_id != null
          || !activeFlag(storedRefresh.revoked)
          || parseSqlDateTime(storedRefresh.expires_at)?.getTime() !== refreshExpiresAt.getTime())
          throw new Error('Failed to persist the delegated refresh token.')
      }

      return {
        accessToken,
        ...(refreshToken ? { refreshToken } : {}),
        tokenType: 'Bearer',
        expiresIn: Math.max(0, Math.floor((accessExpiresAt.getTime() - createdAt.getTime()) / 1000)),
        grantId: grant.grantId,
        clientId: grant.clientId,
        subjectType: grant.subjectType,
        subjectId: grant.subjectId,
        scopes: grant.scopes,
        resources: grant.resources,
        audiences: grant.audiences,
        workspaceId: grant.workspaceId,
      }
    })
  }
  catch (error) {
    if (error instanceof InactiveOAuthClientError)
      return invalidGrant
    throw error
  }
}

/** Authenticate the provider client and exchange its code under one policy lock. */
export async function exchangeOAuthAuthorizationCode(
  input: ExchangeOAuthAuthorizationCodeInput,
): Promise<OAuthAuthorizationCodeExchangeResult> {
  const { clientSecret, ...exchange } = input
  const result = await withAuthenticatedOAuthTokenClient(String(input.clientId), clientSecret, async client =>
    exchangeAuthorizationCode({
      ...exchange,
      issueRefreshToken: client.grantTypes.includes('refresh_token'),
    }))
  return result ?? invalidClient
}
