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
  clientId: number
  subjectType: string
  subjectId: number
  redirectUri: string
  scopes: readonly string[]
  resources: readonly string[]
  audiences: readonly string[]
  workspaceId?: string | null
  codeChallenge: string
  lifetimeMs: number
}

export interface AuthorizationCodeRedemption {
  clientId: number
  redirectUri: string
  codeVerifier: string
}

export interface AuthorizationCodeGrant {
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
}

const invalidGrant = { ok: false as const, reason: 'invalid_grant' as const }
const AUTHORIZATION_CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/

function codeHash(value: string): string {
  return createHash('sha256').update(value, 'ascii').digest('hex')
}

function validIdentifier(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

function explicitValues(name: string, values: readonly string[]): string[] {
  if (values.some(value => !value))
    throw new TypeError(`OAuth authorization code ${name} must not contain empty values.`)
  if (new Set(values).size !== values.length)
    throw new TypeError(`OAuth authorization code ${name} must not contain duplicate values.`)
  return [...values]
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
  if (!validIdentifier(input.clientId) || !validIdentifier(input.subjectId))
    throw new TypeError('OAuth authorization code client and subject identifiers must be positive safe integers.')
  if (!/^[A-Za-z0-9_.:-]{1,255}$/.test(input.subjectType))
    throw new TypeError('OAuth authorization code subject type is invalid.')
  if (!isValidOAuthRedirectUri(input.redirectUri))
    throw new TypeError('OAuth authorization code redirect URI is invalid.')
  if (!isValidS256CodeChallenge(input.codeChallenge))
    throw new TypeError('OAuth authorization code requires a valid S256 challenge.')
  if (!Number.isFinite(input.lifetimeMs) || input.lifetimeMs <= 0)
    throw new TypeError('OAuth authorization code lifetime must be positive.')
  if (input.workspaceId != null && (!input.workspaceId || input.workspaceId.length > 255))
    throw new TypeError('OAuth authorization code workspace identifier must be 1 to 255 characters.')

  const scopes = explicitValues('scopes', input.scopes)
  const resources = explicitValues('resources', input.resources)
  const audiences = explicitValues('audiences', input.audiences)
  const plainTextCode = randomBytes(32).toString('base64url')
  const createdAt = new Date()
  const sql = sqlHelpers(getDatabaseDialect())
  const bound = sql.params(
    codeHash(plainTextCode),
    input.clientId,
    input.subjectType,
    input.subjectId,
    input.redirectUri,
    JSON.stringify(scopes),
    JSON.stringify(resources),
    JSON.stringify(audiences),
    input.workspaceId ?? null,
    input.codeChallenge,
    'S256',
    sqlDateTime(new Date(createdAt.getTime() + input.lifetimeMs)),
    sqlDateTime(createdAt),
  )

  await db.transaction(async (rawTrx) => {
    const trx = rawTrx as unknown as { unsafe: (statement: string, params?: unknown[]) => Promise<unknown> }
    await trx.unsafe(`
      INSERT INTO oauth_auth_codes (
        code_hash, client_id, subject_type, subject_id, redirect_uri, scopes, resources,
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
      SELECT code_hash, client_id, subject_type, subject_id, redirect_uri, scopes, resources,
        audiences, workspace_id, code_challenge, code_challenge_method, expires_at, consumed_at
      FROM oauth_auth_codes
      WHERE code_hash = ${sql.param(1)}
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
    const clientId = Number(row.client_id)
    const subjectId = Number(row.subject_id)
    if (!scopes || !resources || !audiences || !validIdentifier(clientId) || !validIdentifier(subjectId))
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
