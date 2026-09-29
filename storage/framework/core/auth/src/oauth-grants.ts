import { randomBytes } from 'node:crypto'
import {
  db,
  getDatabaseDialect,
  markContextWrote,
  mutationCount,
  parseSqlDateTime,
  sqlDateTime,
  sqlHelpers,
} from '@stacksjs/database/runtime'
import {
  oauthAuthorizationClientFromStored,
  type StoredOAuthAuthorizationClient,
} from './oauth-client-policy'

export interface CreateOAuthGrantInput {
  clientId: number
  subjectType: string
  subjectId: number
  scopes: readonly string[]
  resources: readonly string[]
  audiences: readonly string[]
  workspaceId?: string | null
}

export interface OAuthGrant {
  id: string
  clientId: number
  subjectType: string
  subjectId: number
  scopes: string[]
  resources: string[]
  audiences: string[]
  workspaceId: string | null
  createdAt: Date
}

export interface OAuthConnectedApplication {
  grantId: string
  clientId: number
  clientName: string
  scopes: string[]
  resources: string[]
  audiences: string[]
  workspaceId: string | null
  createdAt: Date
}

interface StoredOAuthConnection {
  grant_id: string
  client_id: number | string
  client_name: string
  scopes: string
  resources: string
  audiences: string
  workspace_id: string | null
  created_at: string | Date
}

function validIdentifier(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

function explicitValues(name: string, values: readonly string[]): string[] {
  if (values.some(value => !value) || new Set(values).size !== values.length)
    throw new TypeError(`OAuth grant ${name} must contain unique non-empty values.`)
  return [...values]
}

function storedValues(value: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed)
      && parsed.every(item => typeof item === 'string' && item.length > 0)
      && new Set(parsed).size === parsed.length
      ? parsed
      : null
  }
  catch {
    return null
  }
}

/** Persist the exact consent a user approved. Grants are immutable until revoked. */
export async function createOAuthGrant(input: CreateOAuthGrantInput): Promise<OAuthGrant> {
  if (!validIdentifier(input.clientId) || !validIdentifier(input.subjectId))
    throw new TypeError('OAuth grant client and subject identifiers must be positive safe integers.')
  if (!/^[A-Za-z0-9_.:-]{1,255}$/.test(input.subjectType))
    throw new TypeError('OAuth grant subject type is invalid.')
  if (input.workspaceId != null && (!input.workspaceId || input.workspaceId.length > 255))
    throw new TypeError('OAuth grant workspace identifier must be 1 to 255 characters.')

  const scopes = explicitValues('scopes', input.scopes)
  const resources = explicitValues('resources', input.resources)
  const audiences = explicitValues('audiences', input.audiences)
  if (scopes.length === 0)
    throw new TypeError('OAuth grant must contain at least one scope.')
  if (resources.length !== audiences.length)
    throw new TypeError('OAuth grant resource and audience bindings must have equal lengths.')
  const id = randomBytes(16).toString('hex')
  const createdAt = new Date()
  const sql = sqlHelpers(getDatabaseDialect())
  const bound = sql.params(
    id,
    input.clientId,
    input.subjectType,
    input.subjectId,
    JSON.stringify(scopes),
    JSON.stringify(resources),
    JSON.stringify(audiences),
    input.workspaceId ?? null,
    sqlDateTime(createdAt),
  )

  await db.transaction(async (rawTrx) => {
    const trx = rawTrx as unknown as { unsafe: (statement: string, params?: unknown[]) => Promise<unknown> }
    const clientLock = sql.isPostgres ? ' FOR SHARE' : sql.isMysql ? ' LOCK IN SHARE MODE' : ''
    const clients = await trx.unsafe(`
      SELECT id, secret, redirect, client_type, redirect_uris, grant_types,
        token_endpoint_auth_method, allowed_scopes, allowed_resources,
        personal_access_client, password_client, revoked
      FROM oauth_clients
      WHERE id = ${sql.param(1)}
      LIMIT 1${clientLock}
    `, [input.clientId]) as unknown as StoredOAuthAuthorizationClient[]
    const client = oauthAuthorizationClientFromStored(clients[0], input.clientId)
    if (!client || client.revoked)
      throw new Error('OAuth client is not an active provider authorization client.')
    if (scopes.some(scope => !client.scopes.includes(scope)))
      throw new Error('OAuth grant scope is not registered to the client.')
    if (resources.some(resource => !client.resources.includes(resource)))
      throw new Error('OAuth grant resource is not registered to the client.')

    await trx.unsafe(`
      INSERT INTO oauth_grants (
        id, client_id, subject_type, subject_id, scopes, resources, audiences, workspace_id, created_at
      ) VALUES (${bound.sql})
    `, bound.values)
  })
  markContextWrote()

  return {
    id,
    clientId: input.clientId,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    scopes,
    resources,
    audiences,
    workspaceId: input.workspaceId ?? null,
    createdAt,
  }
}

/** Revoke one consent grant. Replays are idempotent and report no new change. */
export async function revokeOAuthGrant(id: string): Promise<boolean> {
  if (!/^[a-f0-9]{32}$/.test(id))
    return false

  const sql = sqlHelpers(getDatabaseDialect())
  const now = sqlDateTime(new Date())
  const result = await db.unsafe(`
    UPDATE oauth_grants
    SET revoked_at = ${sql.param(1)}, updated_at = ${sql.param(2)}
    WHERE id = ${sql.param(3)} AND revoked_at IS NULL
  `, [now, now, id]).execute()
  const revoked = mutationCount(result) === 1
  if (revoked)
    markContextWrote()
  return revoked
}

/** Revoke one subject's delegated grants and pending codes during recovery. */
export async function revokeOAuthSubjectAuthorizationState(subjectType: string, subjectId: number): Promise<void> {
  if (!/^[A-Za-z0-9_.:-]{1,255}$/.test(subjectType) || !validIdentifier(subjectId))
    throw new TypeError('OAuth authorization subject is invalid.')

  const sql = sqlHelpers(getDatabaseDialect())
  const now = sqlDateTime(new Date())
  try {
    // Keep missing optional OAuth tables from aborting an enclosing recovery
    // transaction on PostgreSQL. Other storage failures must still roll back
    // the password, reset-token claim, and every credential revocation.
    await db.transaction(async (rawTrx) => {
      const trx = rawTrx as unknown as { unsafe: (statement: string, params?: unknown[]) => Promise<unknown> }
      await trx.unsafe(`
        UPDATE oauth_grants
        SET revoked_at = ${sql.param(1)}, updated_at = ${sql.param(2)}
        WHERE subject_type = ${sql.param(3)} AND subject_id = ${sql.param(4)}
          AND revoked_at IS NULL
      `, [now, now, subjectType, subjectId])
      await trx.unsafe(`
        UPDATE oauth_auth_codes
        SET consumed_at = ${sql.param(1)}
        WHERE subject_type = ${sql.param(2)} AND subject_id = ${sql.param(3)}
          AND consumed_at IS NULL
      `, [now, subjectType, subjectId])

      const remaining = await trx.unsafe(`
        SELECT id FROM oauth_grants
        WHERE subject_type = ${sql.param(1)} AND subject_id = ${sql.param(2)}
          AND revoked_at IS NULL
        UNION ALL
        SELECT code_hash FROM oauth_auth_codes
        WHERE subject_type = ${sql.param(3)} AND subject_id = ${sql.param(4)}
          AND consumed_at IS NULL
        LIMIT 1
      `, [subjectType, subjectId, subjectType, subjectId]) as unknown[]
      if (remaining.length > 0)
        throw new Error('[auth] OAuth authorization state could not be revoked.')
    })
  }
  catch (error) {
    const message = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message : String(error)
    if (/^(?:no such table: (?:main\.)?oauth_(?:grants|auth_codes)|relation "oauth_(?:grants|auth_codes)" does not exist|Table '(?:[^'.]+\.)?oauth_(?:grants|auth_codes)' doesn't exist)$/i.test(message))
      return
    throw error
  }
  markContextWrote()
}

/** List the active third-party applications connected to one OAuth subject. */
export async function listOAuthConnections(subjectType: string, subjectId: number): Promise<OAuthConnectedApplication[]> {
  if (!/^[A-Za-z0-9_.:-]{1,255}$/.test(subjectType) || !validIdentifier(subjectId))
    return []

  const sql = sqlHelpers(getDatabaseDialect())
  const rows = await db.primary.unsafe(`
    SELECT g.id AS grant_id, g.client_id, c.name AS client_name, g.scopes,
      g.resources, g.audiences, g.workspace_id, g.created_at
    FROM oauth_grants g
    JOIN oauth_clients c ON c.id = g.client_id AND c.revoked = ${sql.boolFalse}
    WHERE g.subject_type = ${sql.param(1)} AND g.subject_id = ${sql.param(2)}
      AND g.revoked_at IS NULL
    ORDER BY g.created_at DESC, g.id DESC
  `, [subjectType, subjectId]) as unknown as StoredOAuthConnection[]

  return rows.flatMap((row): OAuthConnectedApplication[] => {
    const clientId = Number(row.client_id)
    const scopes = storedValues(row.scopes)
    const resources = storedValues(row.resources)
    const audiences = storedValues(row.audiences)
    const createdAt = parseSqlDateTime(row.created_at)
    if (!/^[a-f0-9]{32}$/.test(row.grant_id)
      || !validIdentifier(clientId)
      || typeof row.client_name !== 'string'
      || !row.client_name
      || !scopes
      || !resources
      || !audiences
      || !createdAt)
      return []

    return [{
      grantId: row.grant_id,
      clientId,
      clientName: row.client_name,
      scopes,
      resources,
      audiences,
      workspaceId: row.workspace_id,
      createdAt,
    }]
  })
}

/** Disconnect one application without allowing another subject to revoke it. */
export async function disconnectOAuthGrant(subjectType: string, subjectId: number, grantId: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_.:-]{1,255}$/.test(subjectType)
    || !validIdentifier(subjectId)
    || !/^[a-f0-9]{32}$/.test(grantId))
    return false

  const sql = sqlHelpers(getDatabaseDialect())
  const lock = sql.isSqlite ? '' : ' FOR UPDATE'
  const disconnected = await db.transaction(async (rawTrx) => {
    const trx = rawTrx as unknown as { unsafe: (statement: string, params?: unknown[]) => Promise<unknown> }
    const rows = await trx.unsafe(`
      SELECT id FROM oauth_grants
      WHERE id = ${sql.param(1)} AND subject_type = ${sql.param(2)}
        AND subject_id = ${sql.param(3)} AND revoked_at IS NULL
      LIMIT 1${lock}
    `, [grantId, subjectType, subjectId]) as unknown[]
    if (rows.length !== 1)
      return false

    const now = sqlDateTime(new Date())
    const changed = await trx.unsafe(`
      UPDATE oauth_grants
      SET revoked_at = ${sql.param(1)}, updated_at = ${sql.param(2)}
      WHERE id = ${sql.param(3)} AND subject_type = ${sql.param(4)}
        AND subject_id = ${sql.param(5)} AND revoked_at IS NULL
    `, [now, now, grantId, subjectType, subjectId])
    if (mutationCount(changed) !== 1)
      return false

    await trx.unsafe(`
      UPDATE oauth_auth_codes
      SET consumed_at = ${sql.param(1)}
      WHERE grant_id = ${sql.param(2)} AND consumed_at IS NULL
    `, [now, grantId])
    await trx.unsafe(`
      UPDATE oauth_refresh_tokens
      SET revoked = ${sql.boolTrue}
      WHERE access_token_id IN (
        SELECT id FROM oauth_access_tokens WHERE oauth_grant_id = ${sql.param(1)}
      )
    `, [grantId])
    await trx.unsafe(`
      UPDATE oauth_access_tokens
      SET revoked = ${sql.boolTrue}, updated_at = ${sql.param(1)}
      WHERE oauth_grant_id = ${sql.param(2)}
    `, [now, grantId])
    return true
  })

  if (disconnected)
    markContextWrote()
  return disconnected
}
