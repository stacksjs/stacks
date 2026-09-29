import type { AuthorizationCodeGrant, AuthorizationCodeRedemption, AuthorizationCodeResult } from './oauth-authorization-codes'
import type { OAuthDelegatedSubject } from './oauth-delegated-access'
import { createHash, randomBytes } from 'node:crypto'
import {
  db,
  getDatabaseDialect,
  markContextWrote,
  mutationCount,
  parseSqlDateTime,
  sqlDateTime,
  sqlHelpers,
} from '@stacksjs/database/runtime'
import { withAuthorizationCode } from './oauth-authorization-codes'
import { withAuthenticatedOAuthTokenClient } from './oauth-client-registration'
import { disconnectOAuthGrant } from './oauth-grants'
import { verifyS256CodeChallenge } from './oauth-pkce'

export interface ExchangeAuthorizationCodeInput extends AuthorizationCodeRedemption {
  code: string
  accessTokenLifetimeMs: number
  refreshTokenLifetimeMs: number
  issueRefreshToken?: boolean
  isSubjectEligible?: OAuthSubjectEligibility
}

export interface ExchangeOAuthAuthorizationCodeInput extends ExchangeAuthorizationCodeInput {
  clientSecret?: string
}

export interface RefreshOAuthDelegatedTokenInput {
  refreshToken: string
  clientId: number
  clientSecret?: string
  scopes?: readonly string[]
  accessTokenLifetimeMs: number
  refreshTokenLifetimeMs: number
  isSubjectEligible?: OAuthSubjectEligibility
}

export type OAuthSubjectEligibility = (subject: OAuthDelegatedSubject) => boolean | Promise<boolean>

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
  id: number | string
  access_token_id: number | string
  token: string
  family_id: string | null
  parent_id: number | string | null
  revoked: boolean | number
  expires_at: string | Date
}

interface DelegatedRefreshTokenRow extends StoredRefreshToken {
  created_at: string | Date
  tokenable_type: string
  tokenable_id: number | string
  oauth_client_id: number | string
  oauth_grant_id: string | null
  scopes: string
  resources: string | null
  audiences: string | null
  workspace_id: string | null
  access_revoked: boolean | number
}

interface StoredOAuthGrant {
  id: string
  grant_client_id: number | string
  grant_subject_type: string
  grant_subject_id: number | string
  grant_scopes: string
  grant_resources: string
  grant_audiences: string
  grant_workspace_id: string | null
  grant_revoked_at: string | Date | null
}

interface ConsumedAuthorizationCode {
  grant_id: string | null
  client_id: number | string
  subject_type: string
  subject_id: number | string
  redirect_uri: string
  code_challenge: string
  code_challenge_method: string
  consumed_at: string | Date | null
}

interface MintDelegatedTokenOptions {
  accessLifetimeMs: number
  refreshLifetimeMs: number
  issueRefreshToken: boolean
  refreshFamilyId?: string
  refreshParentId?: number | null
}

type DelegatedGrant = Omit<AuthorizationCodeGrant, 'redirectUri'>

class InactiveOAuthClientError extends Error {}

const invalidGrant = { ok: false as const, reason: 'invalid_grant' as const }
const invalidClient = { ok: false as const, reason: 'invalid_client' as const }
const unauthorizedClient = { ok: false as const, reason: 'unauthorized_client' as const }
const invalidScope = { ok: false as const, reason: 'invalid_scope' as const }
const inactiveSubject = Symbol('inactive-oauth-subject')

export type OAuthAuthorizationCodeExchangeResult
  = AuthorizationCodeResult<DelegatedTokenPair>
    | typeof invalidClient

export type OAuthRefreshTokenExchangeResult
  = AuthorizationCodeResult<DelegatedTokenPair>
    | typeof invalidClient
    | typeof invalidScope
    | typeof unauthorizedClient

function tokenHash(value: string): string {
  return createHash('sha256').update(value, 'ascii').digest('hex')
}

async function containAuthorizationCodeReplay(input: ExchangeAuthorizationCodeInput): Promise<void> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(input.code))
    return

  const sql = sqlHelpers(getDatabaseDialect())
  const rows = await db.unsafe(`
    SELECT grant_id, client_id, subject_type, subject_id, redirect_uri,
      code_challenge, code_challenge_method, consumed_at
    FROM oauth_auth_codes
    WHERE code_hash = ${sql.param(1)}
    LIMIT 1
  `, [tokenHash(input.code)]) as unknown as ConsumedAuthorizationCode[]
  const code = rows[0]
  const subjectId = Number(code?.subject_id)
  if (!code?.consumed_at
    || !code.grant_id
    || !/^[a-f0-9]{32}$/.test(code.grant_id)
    || String(code.client_id) !== String(input.clientId)
    || !Number.isSafeInteger(subjectId)
    || subjectId <= 0
    || code.redirect_uri !== input.redirectUri
    || code.code_challenge_method !== 'S256'
    || !await verifyS256CodeChallenge(input.codeVerifier, code.code_challenge))
    return

  await disconnectOAuthGrant(code.subject_type, subjectId, code.grant_id)
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

async function mintDelegatedTokenPair(
  grant: DelegatedGrant,
  options: MintDelegatedTokenOptions,
): Promise<DelegatedTokenPair> {
  const sql = sqlHelpers(getDatabaseDialect())
  const accessToken = randomBytes(40).toString('hex')
  const refreshToken = options.issueRefreshToken ? randomBytes(40).toString('hex') : undefined
  const refreshFamilyId = refreshToken ? options.refreshFamilyId ?? randomBytes(16).toString('hex') : undefined
  if (refreshFamilyId && !/^[a-f0-9]{32}$/.test(refreshFamilyId))
    throw new TypeError('OAuth refresh token family identifier is invalid.')
  const accessHash = tokenHash(accessToken)
  const refreshHash = refreshToken ? tokenHash(refreshToken) : undefined
  const createdAt = new Date()
  if (sql.isMysql) createdAt.setUTCMilliseconds(0)
  const accessExpiresAt = deadline(createdAt, options.accessLifetimeMs, sql.isMysql)
  const refreshExpiresAt = options.issueRefreshToken ? deadline(createdAt, options.refreshLifetimeMs, sql.isMysql) : undefined
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
      options.refreshParentId ?? null,
      revoked,
      sqlDateTime(refreshExpiresAt),
      sqlDateTime(createdAt),
    )
    await db.unsafe(`
      INSERT INTO oauth_refresh_tokens (access_token_id, token, family_id, parent_id, revoked, expires_at, created_at)
      VALUES (${refreshValues.sql})
    `, refreshValues.values)
    const refreshRows = await db.unsafe(`
      SELECT id, access_token_id, token, family_id, parent_id, revoked, expires_at
      FROM oauth_refresh_tokens WHERE token = ${sql.param(1)} LIMIT 1
    `, [refreshHash]) as unknown as StoredRefreshToken[]
    const storedRefresh = refreshRows[0]
    if (!storedRefresh
      || String(storedRefresh.access_token_id) !== String(storedAccess.id)
      || storedRefresh.family_id !== refreshFamilyId
      || String(storedRefresh.parent_id ?? '') !== String(options.refreshParentId ?? '')
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
}

function grantFromRefreshRows(
  refresh: DelegatedRefreshTokenRow,
  stored: StoredOAuthGrant | undefined,
): DelegatedGrant | null {
  const clientId = Number(refresh.oauth_client_id)
  const subjectId = Number(refresh.tokenable_id)
  const scopes = storedValues(refresh.scopes)
  const resources = storedValues(refresh.resources)
  const audiences = storedValues(refresh.audiences)
  const grantScopes = storedValues(stored?.grant_scopes ?? null)
  const grantResources = storedValues(stored?.grant_resources ?? null)
  const grantAudiences = storedValues(stored?.grant_audiences ?? null)
  if (!stored || stored.grant_revoked_at != null || !refresh.oauth_grant_id
    || !/^[a-f0-9]{32}$/.test(refresh.oauth_grant_id)
    || !Number.isSafeInteger(clientId) || clientId <= 0
    || !Number.isSafeInteger(subjectId) || subjectId <= 0
    || !scopes?.length || new Set(scopes).size !== scopes.length || !resources || !audiences
    || !grantScopes || !grantResources || !grantAudiences
    || String(stored.grant_client_id) !== String(clientId)
    || stored.grant_subject_type !== refresh.tokenable_type
    || String(stored.grant_subject_id) !== String(subjectId)
    || !scopes.every(scope => grantScopes.includes(scope))
    || JSON.stringify(grantResources) !== JSON.stringify(resources)
    || JSON.stringify(grantAudiences) !== JSON.stringify(audiences)
    || stored.grant_workspace_id !== refresh.workspace_id)
    return null

  return {
    grantId: refresh.oauth_grant_id,
    clientId,
    subjectType: refresh.tokenable_type,
    subjectId,
    scopes,
    resources,
    audiences,
    workspaceId: refresh.workspace_id,
  }
}

async function revokeDelegatedRefreshFamily(refresh: DelegatedRefreshTokenRow): Promise<void> {
  const sql = sqlHelpers(getDatabaseDialect())
  const revoked = sql.isPostgres ? true : 1
  if (refresh.family_id && /^[a-f0-9]{32}$/.test(refresh.family_id)) {
    await db.unsafe(`
      UPDATE oauth_access_tokens
      SET revoked = ${sql.param(1)}
      WHERE id IN (
        SELECT access_token_id FROM oauth_refresh_tokens WHERE family_id = ${sql.param(2)}
      )
    `, [revoked, refresh.family_id])
    await db.unsafe(`
      UPDATE oauth_refresh_tokens
      SET revoked = ${sql.param(1)}
      WHERE family_id = ${sql.param(2)}
    `, [revoked, refresh.family_id])
    return
  }

  await db.unsafe(`UPDATE oauth_access_tokens SET revoked = ${sql.param(1)} WHERE id = ${sql.param(2)}`, [revoked, refresh.access_token_id])
  await db.unsafe(`UPDATE oauth_refresh_tokens SET revoked = ${sql.param(1)} WHERE id = ${sql.param(2)}`, [revoked, refresh.id])
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
    const result = await withAuthorizationCode<DelegatedTokenPair | typeof inactiveSubject>(input.code, input, async (grant) => {
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
      if (input.isSubjectEligible && !await input.isSubjectEligible({
        type: grant.subjectType,
        id: grant.subjectId,
        clientId: grant.clientId,
        grantId: grant.grantId,
        workspaceId: grant.workspaceId,
      })) {
        if (!await disconnectOAuthGrant(grant.subjectType, grant.subjectId, grant.grantId))
          throw new Error('Inactive OAuth subject authorization state could not be revoked.')
        return inactiveSubject
      }

      return mintDelegatedTokenPair(grant, {
        accessLifetimeMs,
        refreshLifetimeMs,
        issueRefreshToken,
      })
    })
    if (!result.ok)
      return result
    return result.value === inactiveSubject ? invalidGrant : { ok: true, value: result.value }
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
  const result = await withAuthenticatedOAuthTokenClient(String(input.clientId), clientSecret, async (client) => {
    const exchanged = await exchangeAuthorizationCode({
      ...exchange,
      issueRefreshToken: client.grantTypes.includes('refresh_token'),
    })
    if (!exchanged.ok)
      await containAuthorizationCodeReplay(exchange)
    return exchanged
  })
  return result ?? invalidClient
}

/** Rotate one delegated refresh token and contain reuse to its token family. */
export async function refreshOAuthDelegatedToken(
  input: RefreshOAuthDelegatedTokenInput,
): Promise<OAuthRefreshTokenExchangeResult> {
  const accessLifetimeMs = validLifetime(input.accessTokenLifetimeMs)
  const refreshLifetimeMs = validLifetime(input.refreshTokenLifetimeMs)
  const authenticated = await withAuthenticatedOAuthTokenClient(String(input.clientId), input.clientSecret, async (client) => {
    if (!client.grantTypes.includes('refresh_token'))
      return { result: unauthorizedClient as OAuthRefreshTokenExchangeResult, wrote: false }
    if (!/^[a-f0-9]{80}$/.test(input.refreshToken))
      return { result: invalidGrant as OAuthRefreshTokenExchangeResult, wrote: false }

    const sql = sqlHelpers(getDatabaseDialect())
    const hash = tokenHash(input.refreshToken)
    const lock = sql.isSqlite ? '' : ' FOR UPDATE'
    const lookup = await db.unsafe(`
      SELECT r.id, r.family_id, a.oauth_client_id
      FROM oauth_refresh_tokens r
      JOIN oauth_access_tokens a ON a.id = r.access_token_id
      WHERE r.token = ${sql.param(1)}
      LIMIT 1
    `, [hash]) as unknown as Array<{ id: number | string, family_id: string | null, oauth_client_id: number | string }>
    const candidate = lookup[0]
    if (!candidate || String(candidate.oauth_client_id) !== String(input.clientId))
      return { result: invalidGrant as OAuthRefreshTokenExchangeResult, wrote: false }

    if (candidate.family_id && /^[a-f0-9]{32}$/.test(candidate.family_id)) {
      await db.unsafe(`
        SELECT id FROM oauth_refresh_tokens
        WHERE family_id = ${sql.param(1)}
        ORDER BY id${lock}
      `, [candidate.family_id])
    }

    const rows = await db.unsafe(`
      SELECT r.id, r.access_token_id, r.token, r.family_id, r.parent_id, r.revoked,
        r.expires_at, r.created_at, a.tokenable_type, a.tokenable_id,
        a.oauth_client_id, a.oauth_grant_id, a.scopes, a.resources, a.audiences,
        a.workspace_id, a.revoked AS access_revoked
      FROM oauth_refresh_tokens r
      JOIN oauth_access_tokens a ON a.id = r.access_token_id
      WHERE r.id = ${sql.param(1)} AND r.token = ${sql.param(2)}
      LIMIT 1${lock}
    `, [candidate.id, hash]) as unknown as DelegatedRefreshTokenRow[]
    const refresh = rows[0]
    if (!refresh || String(refresh.oauth_client_id) !== String(input.clientId))
      return { result: invalidGrant as OAuthRefreshTokenExchangeResult, wrote: false }

    const familyIsValid = Boolean(refresh.family_id && /^[a-f0-9]{32}$/.test(refresh.family_id))
    if (!activeFlag(refresh.revoked) || !activeFlag(refresh.access_revoked) || !familyIsValid) {
      await revokeDelegatedRefreshFamily(refresh)
      return { result: invalidGrant as OAuthRefreshTokenExchangeResult, wrote: true }
    }
    if ((parseSqlDateTime(refresh.expires_at)?.getTime() ?? 0) <= Date.now())
      return { result: invalidGrant as OAuthRefreshTokenExchangeResult, wrote: false }

    const grantLock = sql.isSqlite ? '' : ' FOR UPDATE'
    const grants = await db.unsafe(`
      SELECT id, client_id AS grant_client_id, subject_type AS grant_subject_type,
        subject_id AS grant_subject_id, scopes AS grant_scopes,
        resources AS grant_resources, audiences AS grant_audiences,
        workspace_id AS grant_workspace_id, revoked_at AS grant_revoked_at
      FROM oauth_grants
      WHERE id = ${sql.param(1)}
      LIMIT 1${grantLock}
    `, [refresh.oauth_grant_id]) as unknown as StoredOAuthGrant[]
    const grant = grantFromRefreshRows(refresh, grants[0])
    if (!grant) {
      await revokeDelegatedRefreshFamily(refresh)
      return { result: invalidGrant as OAuthRefreshTokenExchangeResult, wrote: true }
    }
    if (input.isSubjectEligible && !await input.isSubjectEligible({
      type: grant.subjectType,
      id: grant.subjectId,
      clientId: grant.clientId,
      grantId: grant.grantId,
      workspaceId: grant.workspaceId,
    })) {
      if (!await disconnectOAuthGrant(grant.subjectType, grant.subjectId, grant.grantId))
        throw new Error('Inactive OAuth subject authorization state could not be revoked.')
      return { result: invalidGrant as OAuthRefreshTokenExchangeResult, wrote: true }
    }
    const scopes = input.scopes ? [...input.scopes] : grant.scopes
    if (!scopes.length
      || new Set(scopes).size !== scopes.length
      || !scopes.every(scope => grant.scopes.includes(scope) && client.scopes.includes(scope)))
      return { result: invalidScope as OAuthRefreshTokenExchangeResult, wrote: false }

    const revoked = sql.isPostgres ? true : 1
    const refreshClaim = await db.unsafe(`
      UPDATE oauth_refresh_tokens
      SET revoked = ${sql.param(1)}
      WHERE id = ${sql.param(2)} AND revoked = ${sql.param(3)}
    `, [revoked, refresh.id, sql.isPostgres ? false : 0])
    const accessClaim = await db.unsafe(`
      UPDATE oauth_access_tokens
      SET revoked = ${sql.param(1)}
      WHERE id = ${sql.param(2)} AND revoked = ${sql.param(3)}
    `, [revoked, refresh.access_token_id, sql.isPostgres ? false : 0])
    if (mutationCount(refreshClaim) !== 1 || mutationCount(accessClaim) !== 1) {
      await revokeDelegatedRefreshFamily(refresh)
      return { result: invalidGrant as OAuthRefreshTokenExchangeResult, wrote: true }
    }

    const pair = await mintDelegatedTokenPair({ ...grant, scopes }, {
      accessLifetimeMs,
      refreshLifetimeMs,
      issueRefreshToken: true,
      refreshFamilyId: refresh.family_id!,
      refreshParentId: Number(refresh.id),
    })
    return { result: { ok: true as const, value: pair }, wrote: true }
  })

  if (!authenticated)
    return invalidClient
  if (authenticated.wrote)
    markContextWrote()
  return authenticated.result
}
