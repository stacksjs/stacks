import { randomBytes } from 'node:crypto'
import {
  db,
  getDatabaseDialect,
  markContextWrote,
  mutationCount,
  sqlDateTime,
  sqlHelpers,
} from '@stacksjs/database/runtime'

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

function validIdentifier(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

function explicitValues(name: string, values: readonly string[]): string[] {
  if (values.some(value => !value) || new Set(values).size !== values.length)
    throw new TypeError(`OAuth grant ${name} must contain unique non-empty values.`)
  return [...values]
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
      SELECT id FROM oauth_clients
      WHERE id = ${sql.param(1)} AND revoked = ${sql.boolFalse}
      LIMIT 1${clientLock}
    `, [input.clientId]) as unknown[]
    if (clients.length !== 1)
      throw new Error('OAuth client is not active.')

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
