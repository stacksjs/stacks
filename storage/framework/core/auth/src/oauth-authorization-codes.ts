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
import { isValidOAuthRedirectUri } from './oauth-authorization'
import { isValidS256CodeChallenge, verifyS256CodeChallenge } from './oauth-pkce'

export interface IssueAuthorizationCodeInput {
  grantId: string
  redirectUri: string
  codeChallenge: string
  lifetimeMs: number
}

export interface AuthorizationCodeRedemption {
  clientId: number
  redirectUri: string
  codeVerifier: string
}

export interface AuthorizationCodeGrant {
  grantId: string
  clientId: number
  subjectType: string
  subjectId: number
  redirectUri: string
  scopes: string[]
  resources: string[]
  audiences: string[]
  workspaceId: string | null
}

export type AuthorizationCodeResult<T>
  = | { ok: true, value: T }
    | { ok: false, reason: 'invalid_grant' }

interface AuthorizationCodeRow {
  code_hash: string
  grant_id: string | null
  client_id: number | string
  subject_type: string
  subject_id: number | string
  redirect_uri: string
  scopes: string
  resources: string
  audiences: string
  workspace_id: string | null
  code_challenge: string
  code_challenge_method: string
  expires_at: string | Date
  consumed_at: string | Date | null
  grant_client_id: number | string
  grant_subject_type: string
  grant_subject_id: number | string
  grant_scopes: string
  grant_resources: string
  grant_audiences: string
  grant_workspace_id: string | null
}

const invalidGrant = { ok: false as const, reason: 'invalid_grant' as const }
const AUTHORIZATION_CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/

function codeHash(value: string): string {
  return createHash('sha256').update(value, 'ascii').digest('hex')
}

function validIdentifier(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

function storedValues(value: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) && parsed.every(item => typeof item === 'string') ? parsed : null
  }
  catch {
    return null
  }
}

/** Issue a high-entropy code while storing only its SHA-256 hash. */
export async function issueAuthorizationCode(input: IssueAuthorizationCodeInput): Promise<string> {
  if (!/^[a-f0-9]{32}$/.test(input.grantId))
    throw new TypeError('OAuth authorization code grant identifier is invalid.')
  if (!isValidOAuthRedirectUri(input.redirectUri))
    throw new TypeError('OAuth authorization code redirect URI is invalid.')
  if (!isValidS256CodeChallenge(input.codeChallenge))
    throw new TypeError('OAuth authorization code requires a valid S256 challenge.')
  if (!Number.isSafeInteger(input.lifetimeMs) || input.lifetimeMs <= 0)
    throw new TypeError('OAuth authorization code lifetime must be a positive safe integer of milliseconds.')
  const plainTextCode = randomBytes(32).toString('base64url')
  const createdAt = new Date()
  const expiresAt = new Date(createdAt.getTime() + input.lifetimeMs)
  if (!Number.isFinite(expiresAt.getTime()))
    throw new TypeError('OAuth authorization code lifetime is outside the supported date range.')
  const sql = sqlHelpers(getDatabaseDialect())

  await db.transaction(async (rawTrx) => {
    const trx = rawTrx as unknown as { unsafe: (statement: string, params?: unknown[]) => Promise<unknown> }
    const grantLock = sql.isPostgres ? ' FOR SHARE' : sql.isMysql ? ' LOCK IN SHARE MODE' : ''
    const grants = await trx.unsafe(`
      SELECT id, client_id, subject_type, subject_id, scopes, resources, audiences, workspace_id
      FROM oauth_grants
      WHERE id = ${sql.param(1)} AND revoked_at IS NULL
      LIMIT 1${grantLock}
    `, [input.grantId]) as Array<Record<string, unknown>>
    const grant = grants[0]
    if (!grant)
      throw new Error('OAuth authorization grant is not active.')

    const bound = sql.params(
      codeHash(plainTextCode),
      input.grantId,
      grant.client_id,
      grant.subject_type,
      grant.subject_id,
      input.redirectUri,
      grant.scopes,
      grant.resources,
      grant.audiences,
      grant.workspace_id ?? null,
      input.codeChallenge,
      'S256',
      sqlDateTime(expiresAt),
      sqlDateTime(createdAt),
    )
    await trx.unsafe(`
      INSERT INTO oauth_auth_codes (
        code_hash, grant_id, client_id, subject_type, subject_id, redirect_uri, scopes, resources,
        audiences, workspace_id, code_challenge, code_challenge_method, expires_at, created_at
      ) VALUES (${bound.sql})
    `, bound.values)
  })
  markContextWrote()
  return plainTextCode
}

/**
 * Claim one code and complete credential issuance in the same transaction.
 * A failed completion rolls the claim back so an infrastructure failure does
 * not strand a valid grant. Concurrent successful commits remain single-use.
 */
export async function withAuthorizationCode<T>(
  rawCode: string,
  expected: AuthorizationCodeRedemption,
  complete: (grant: AuthorizationCodeGrant) => Promise<T>,
): Promise<AuthorizationCodeResult<T>> {
  if (!AUTHORIZATION_CODE_PATTERN.test(rawCode) || !validIdentifier(expected.clientId))
    return invalidGrant

  const sql = sqlHelpers(getDatabaseDialect())
  const hash = codeHash(rawCode)
  const lock = sql.isSqlite ? '' : ' FOR UPDATE'
  const result = await db.transaction(async (rawTrx): Promise<AuthorizationCodeResult<T>> => {
    const trx = rawTrx as unknown as { unsafe: (statement: string, params?: unknown[]) => Promise<unknown> }
    const rows = await trx.unsafe(`
      SELECT c.code_hash, c.grant_id, c.client_id, c.subject_type, c.subject_id, c.redirect_uri,
        c.scopes, c.resources, c.audiences, c.workspace_id, c.code_challenge,
        c.code_challenge_method, c.expires_at, c.consumed_at,
        g.client_id AS grant_client_id, g.subject_type AS grant_subject_type,
        g.subject_id AS grant_subject_id, g.scopes AS grant_scopes,
        g.resources AS grant_resources, g.audiences AS grant_audiences,
        g.workspace_id AS grant_workspace_id
      FROM oauth_auth_codes c
      JOIN oauth_grants g ON g.id = c.grant_id AND g.revoked_at IS NULL
      WHERE c.code_hash = ${sql.param(1)}
      LIMIT 1${lock}
    `, [hash]) as AuthorizationCodeRow[]
    const row = rows[0]
    if (!row || row.consumed_at != null
      || String(row.client_id) !== String(expected.clientId)
      || row.redirect_uri !== expected.redirectUri
      || row.code_challenge_method !== 'S256'
      || (parseSqlDateTime(row.expires_at)?.getTime() ?? 0) <= Date.now()
      || !(await verifyS256CodeChallenge(expected.codeVerifier, row.code_challenge)))
      return invalidGrant

    const scopes = storedValues(row.scopes)
    const resources = storedValues(row.resources)
    const audiences = storedValues(row.audiences)
    const grantScopes = storedValues(row.grant_scopes)
    const grantResources = storedValues(row.grant_resources)
    const grantAudiences = storedValues(row.grant_audiences)
    const clientId = Number(row.client_id)
    const subjectId = Number(row.subject_id)
    if (!row.grant_id || !scopes || !resources || !audiences
      || !grantScopes || !grantResources || !grantAudiences
      || !validIdentifier(clientId) || !validIdentifier(subjectId)
      || String(row.grant_client_id) !== String(row.client_id)
      || row.grant_subject_type !== row.subject_type
      || String(row.grant_subject_id) !== String(row.subject_id)
      || JSON.stringify(grantScopes) !== JSON.stringify(scopes)
      || JSON.stringify(grantResources) !== JSON.stringify(resources)
      || JSON.stringify(grantAudiences) !== JSON.stringify(audiences)
      || row.grant_workspace_id !== row.workspace_id)
      return invalidGrant

    const now = sqlDateTime(new Date())
    const claimed = await trx.unsafe(`
      UPDATE oauth_auth_codes
      SET consumed_at = ${sql.param(1)}
      WHERE code_hash = ${sql.param(2)}
        AND consumed_at IS NULL
        AND expires_at > ${sql.param(3)}
    `, [now, hash, now])
    if (mutationCount(claimed) !== 1)
      return invalidGrant

    const value = await complete({
      grantId: row.grant_id,
      clientId,
      subjectType: row.subject_type,
      subjectId,
      redirectUri: row.redirect_uri,
      scopes,
      resources,
      audiences,
      workspaceId: row.workspace_id,
    })
    return { ok: true, value }
  })
  if (result.ok)
    markContextWrote()
  return result
}
