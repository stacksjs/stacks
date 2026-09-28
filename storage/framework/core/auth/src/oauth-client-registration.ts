import type { ResolvedOAuthProviderConfig } from './oauth-provider'
import type { OAuthAuthorizationClientRegistration } from './oauth-authorization'
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
import { makeHash, verifyHash } from '@stacksjs/security'
import { isValidOAuthRedirectUri } from './oauth-authorization'

export type OAuthTokenEndpointAuthMethod = 'client_secret_basic' | 'none'

export interface OAuthClientRegistrationInput {
  name: string
  type: 'confidential' | 'public'
  tokenEndpointAuthMethod: OAuthTokenEndpointAuthMethod
  redirectUris: readonly string[]
  grantTypes: readonly string[]
  scopes: readonly string[]
  resources: readonly string[]
}

export interface ValidatedOAuthClientRegistration extends OAuthClientRegistrationInput {
  name: string
  redirectUris: string[]
  grantTypes: string[]
  scopes: string[]
  resources: string[]
  requiresSecret: boolean
}

export interface RegisteredOAuthClient {
  id: number
  ownerId: number
  name: string
  type: 'confidential' | 'public'
  tokenEndpointAuthMethod: OAuthTokenEndpointAuthMethod
  redirectUris: string[]
  grantTypes: string[]
  scopes: string[]
  resources: string[]
  revoked: false
  createdAt: Date
}

export interface RegisteredOAuthClientResult {
  client: RegisteredOAuthClient
  plainTextSecret?: string
}

interface StoredOAuthClient {
  id: number | string
  user_id: number | string | null
  name: string
  secret: string | null
  redirect: string
  client_type: string | null
  redirect_uris: string | null
  grant_types: string | null
  token_endpoint_auth_method: string | null
  allowed_scopes: string | null
  allowed_resources: string | null
  personal_access_client: boolean | number
  password_client: boolean | number
  revoked: boolean | number
  created_at: string | Date
}

export class OAuthClientRegistrationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OAuthClientRegistrationError'
  }
}

function reject(message: string): never {
  throw new OAuthClientRegistrationError(message)
}

function explicitUnique(name: string, values: readonly string[], options: { required?: boolean } = {}): string[] {
  if (options.required && values.length === 0)
    reject(`OAuth client must register at least one ${name}.`)
  if (values.some(value => !value))
    reject(`OAuth client ${name} entries must not be empty.`)
  if (new Set(values).size !== values.length)
    reject(`OAuth client ${name} contains a duplicate entry.`)
  return [...values]
}

/** Validate client-controlled metadata before any secret or database row exists. */
export function validateOAuthClientRegistration(
  provider: ResolvedOAuthProviderConfig,
  input: OAuthClientRegistrationInput,
): ValidatedOAuthClientRegistration {
  const name = input.name.trim()
  if (!name || name.length > 100 || /[\u0000-\u001F\u007F]/.test(name))
    reject('OAuth client name must be 1 to 100 characters without control characters.')

  if (!provider.clientTypes.includes(input.type))
    reject(`OAuth client type is not enabled by this provider: ${input.type}`)
  if (input.type === 'public' && input.tokenEndpointAuthMethod !== 'none')
    reject('Public OAuth clients must use token endpoint authentication method none.')
  if (input.type === 'confidential' && input.tokenEndpointAuthMethod !== 'client_secret_basic')
    reject('Confidential OAuth clients must use token endpoint authentication method client_secret_basic.')

  const redirectUris = explicitUnique('redirect URI', input.redirectUris, { required: true })
  if (redirectUris.some(uri => !isValidOAuthRedirectUri(uri)))
    reject('OAuth client redirect URIs must be exact HTTPS URLs or exact loopback HTTP URLs, without credentials, fragments, or wildcards.')

  const grantTypes = explicitUnique('grant type', input.grantTypes, { required: true })
  if (!grantTypes.includes('authorization_code'))
    reject('OAuth client grant types must include authorization_code.')
  for (const grantType of grantTypes) {
    if (!provider.grantTypes.includes(grantType as 'authorization_code' | 'refresh_token'))
      reject(`OAuth client requested an unsupported grant type: ${grantType}`)
  }

  const scopes = explicitUnique('scope', input.scopes, { required: true })
  for (const scope of scopes) {
    if (!provider.scopes[scope])
      reject(`OAuth client requested an unregistered scope: ${scope}`)
  }

  const resources = explicitUnique('resource', input.resources)
  for (const resource of resources) {
    if (!provider.resources[resource])
      reject(`OAuth client requested an unregistered resource: ${resource}`)
  }

  for (const scope of scopes) {
    const allowedResources = provider.scopes[scope]?.resources
    if (allowedResources?.length && !resources.some(resource => allowedResources.includes(resource)))
      reject(`OAuth client scope requires a registered resource: ${scope}`)
  }

  return {
    name,
    type: input.type,
    tokenEndpointAuthMethod: input.tokenEndpointAuthMethod,
    redirectUris,
    grantTypes,
    scopes,
    resources,
    requiresSecret: input.type === 'confidential',
  }
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

function inactive(value: boolean | number): boolean {
  return value === false || value === 0
}

function storedFlag(value: boolean | number): boolean | null {
  if (value === false || value === 0) return false
  if (value === true || value === 1) return true
  return null
}

function authorizationClientFromStored(
  row: StoredOAuthClient | undefined,
  id: number,
): OAuthAuthorizationClientRegistration | null {
  const redirectUris = storedValues(row?.redirect_uris ?? null)
  const grantTypes = storedValues(row?.grant_types ?? null)
  const scopes = storedValues(row?.allowed_scopes ?? null)
  const resources = storedValues(row?.allowed_resources ?? null)
  const revoked = row ? storedFlag(row.revoked) : null
  const type = row?.client_type
  const method = row?.token_endpoint_auth_method
  if (!row || String(row.id) !== String(id)
    || (type !== 'public' && type !== 'confidential')
    || (method !== 'none' && method !== 'client_secret_basic')
    || (type === 'public' ? method !== 'none' || row.secret != null : method !== 'client_secret_basic' || !row.secret)
    || !redirectUris?.length || !grantTypes?.includes('authorization_code') || !scopes?.length || !resources
    || new Set(redirectUris).size !== redirectUris.length
    || new Set(grantTypes).size !== grantTypes.length
    || new Set(scopes).size !== scopes.length
    || new Set(resources).size !== resources.length
    || redirectUris.some(uri => !isValidOAuthRedirectUri(uri))
    || row.redirect !== redirectUris[0]
    || !inactive(row.personal_access_client)
    || !inactive(row.password_client)
    || revoked == null)
    return null

  return { id, type, revoked, redirectUris, grantTypes, scopes, resources }
}

async function storedAuthorizationClient(clientId: string): Promise<{
  client: OAuthAuthorizationClientRegistration
  row: StoredOAuthClient
} | null> {
  const id = Number(clientId)
  if (!Number.isSafeInteger(id) || id <= 0)
    return null

  const sql = sqlHelpers(getDatabaseDialect())
  const rows = await db.primary.unsafe(`
    SELECT id, secret, redirect, client_type, redirect_uris, grant_types,
      token_endpoint_auth_method, allowed_scopes, allowed_resources,
      personal_access_client, password_client, revoked
    FROM oauth_clients WHERE id = ${sql.param(1)} LIMIT 1
  `, [id]) as unknown as StoredOAuthClient[]
  const row = rows[0]
  const client = authorizationClientFromStored(row, id)
  return row && client ? { client, row } : null
}

/** Load only complete provider registration metadata from authoritative storage. */
export async function loadOAuthAuthorizationClient(clientId: string): Promise<OAuthAuthorizationClientRegistration | null> {
  return (await storedAuthorizationClient(clientId))?.client ?? null
}

/** Authenticate one provider client and hold its policy stable through completion. */
export async function withAuthenticatedOAuthTokenClient<T>(
  clientId: string,
  clientSecret: string | undefined,
  complete: (client: OAuthAuthorizationClientRegistration) => Promise<T>,
): Promise<T | null> {
  const id = Number(clientId)
  if (!Number.isSafeInteger(id) || id <= 0 || (clientSecret != null && clientSecret.length > 4096))
    return null

  const sql = sqlHelpers(getDatabaseDialect())
  const lock = sql.isPostgres ? ' FOR SHARE' : sql.isMysql ? ' LOCK IN SHARE MODE' : ''
  return db.transaction(async (rawTrx) => {
    const trx = rawTrx as unknown as { unsafe: (statement: string, params?: unknown[]) => Promise<unknown> }
    const rows = await trx.unsafe(`
      SELECT id, secret, redirect, client_type, redirect_uris, grant_types,
        token_endpoint_auth_method, allowed_scopes, allowed_resources,
        personal_access_client, password_client, revoked
      FROM oauth_clients WHERE id = ${sql.param(1)} LIMIT 1${lock}
    `, [id]) as unknown as StoredOAuthClient[]
    const row = rows[0]
    const client = authorizationClientFromStored(row, id)
    if (!row || !client || client.revoked)
      return null
    if (client.type === 'public')
      return clientSecret === undefined ? complete(client) : null
    if (!clientSecret || !row.secret)
      return null

    let verified = false
    try { verified = await verifyHash(clientSecret, row.secret) }
    catch {
      return null
    }
    return verified ? complete(client) : null
  })
}

/** Validate and persist one owner-managed provider client. */
export async function registerOAuthClient(
  provider: ResolvedOAuthProviderConfig,
  ownerId: number,
  input: OAuthClientRegistrationInput,
): Promise<RegisteredOAuthClientResult> {
  if (!Number.isSafeInteger(ownerId) || ownerId <= 0)
    throw new TypeError('OAuth client owner identifier must be a positive safe integer.')

  const client = validateOAuthClientRegistration(provider, input)
  const plainTextSecret = client.requiresSecret ? randomBytes(40).toString('hex') : undefined
  const storedSecret = plainTextSecret ? await makeHash(plainTextSecret, { algorithm: 'bcrypt' }) : null
  const sql = sqlHelpers(getDatabaseDialect())
  const createdAt = new Date()
  if (sql.isMysql) createdAt.setUTCMilliseconds(0)
  const disabled = sql.isPostgres ? false : 0

  const stored = await db.transaction(async (rawTrx) => {
    const trx = rawTrx as unknown as { unsafe: (statement: string, params?: unknown[]) => Promise<unknown> }
    const values = sql.params(
      ownerId,
      client.name,
      storedSecret,
      'local',
      client.redirectUris[0],
      client.type,
      JSON.stringify(client.redirectUris),
      JSON.stringify(client.grantTypes),
      client.tokenEndpointAuthMethod,
      JSON.stringify(client.scopes),
      JSON.stringify(client.resources),
      disabled,
      disabled,
      disabled,
      sqlDateTime(createdAt),
    )
    const returning = sql.isMysql ? '' : ' RETURNING id'
    const inserted = await trx.unsafe(`
      INSERT INTO oauth_clients (
        user_id, name, secret, provider, redirect, client_type, redirect_uris, grant_types,
        token_endpoint_auth_method, allowed_scopes, allowed_resources, personal_access_client,
        password_client, revoked, created_at
      ) VALUES (${values.sql})${returning}
    `, values.values) as Array<{ id: number | string }>
    const idRows = sql.isMysql
      ? await trx.unsafe('SELECT LAST_INSERT_ID() AS id') as Array<{ id: number | string }>
      : inserted
    const id = Number(idRows[0]?.id)
    if (!Number.isSafeInteger(id) || id <= 0)
      throw new Error('Failed to resolve the registered OAuth client identifier.')

    const rows = await trx.unsafe(`SELECT * FROM oauth_clients WHERE id = ${sql.param(1)} LIMIT 1`, [id]) as StoredOAuthClient[]
    const row = rows[0]
    if (!row
      || String(row.user_id) !== String(ownerId)
      || row.name !== client.name
      || row.secret !== storedSecret
      || row.redirect !== client.redirectUris[0]
      || row.client_type !== client.type
      || JSON.stringify(storedValues(row.redirect_uris)) !== JSON.stringify(client.redirectUris)
      || JSON.stringify(storedValues(row.grant_types)) !== JSON.stringify(client.grantTypes)
      || row.token_endpoint_auth_method !== client.tokenEndpointAuthMethod
      || JSON.stringify(storedValues(row.allowed_scopes)) !== JSON.stringify(client.scopes)
      || JSON.stringify(storedValues(row.allowed_resources)) !== JSON.stringify(client.resources)
      || !inactive(row.personal_access_client)
      || !inactive(row.password_client)
      || !inactive(row.revoked))
      throw new Error('Failed to persist the registered OAuth client policy.')

    return { id, createdAt: parseSqlDateTime(row.created_at) ?? createdAt }
  })
  markContextWrote()

  return {
    client: {
      id: stored.id,
      ownerId,
      name: client.name,
      type: client.type,
      tokenEndpointAuthMethod: client.tokenEndpointAuthMethod,
      redirectUris: client.redirectUris,
      grantTypes: client.grantTypes,
      scopes: client.scopes,
      resources: client.resources,
      revoked: false,
      createdAt: stored.createdAt,
    },
    ...(plainTextSecret === undefined ? {} : { plainTextSecret }),
  }
}

/** Rotate one active confidential client's secret and reveal the replacement once. */
export async function rotateOAuthClientSecret(ownerId: number, clientId: number): Promise<string | null> {
  if (!Number.isSafeInteger(ownerId) || ownerId <= 0 || !Number.isSafeInteger(clientId) || clientId <= 0)
    return null

  const plainTextSecret = randomBytes(40).toString('hex')
  const storedSecret = await makeHash(plainTextSecret, { algorithm: 'bcrypt' })
  const sql = sqlHelpers(getDatabaseDialect())
  const lock = sql.isSqlite ? '' : ' FOR UPDATE'
  const rotated = await db.transaction(async (rawTrx) => {
    const trx = rawTrx as unknown as { unsafe: (statement: string, params?: unknown[]) => Promise<unknown> }
    const rows = await trx.unsafe(`
      SELECT client_type, token_endpoint_auth_method, revoked
      FROM oauth_clients
      WHERE id = ${sql.param(1)} AND user_id = ${sql.param(2)}
      LIMIT 1${lock}
    `, [clientId, ownerId]) as unknown as Array<{
      client_type: string | null
      token_endpoint_auth_method: string | null
      revoked: boolean | number
    }>
    const client = rows[0]
    if (!client
      || client.client_type !== 'confidential'
      || client.token_endpoint_auth_method !== 'client_secret_basic'
      || !inactive(client.revoked))
      return false

    const active = sql.isPostgres ? false : 0
    const changed = await trx.unsafe(`
      UPDATE oauth_clients
      SET secret = ${sql.param(1)}, updated_at = ${sql.param(2)}
      WHERE id = ${sql.param(3)} AND user_id = ${sql.param(4)}
        AND client_type = ${sql.param(5)} AND token_endpoint_auth_method = ${sql.param(6)}
        AND revoked = ${sql.param(7)}
    `, [storedSecret, sqlDateTime(new Date()), clientId, ownerId, 'confidential', 'client_secret_basic', active])
    return mutationCount(changed) === 1
  })
  if (!rotated)
    return null
  markContextWrote()
  return plainTextSecret
}

/** Disable one owner-managed client and revoke every credential it issued. */
export async function disableOAuthClient(ownerId: number, clientId: number): Promise<boolean> {
  if (!Number.isSafeInteger(ownerId) || ownerId <= 0 || !Number.isSafeInteger(clientId) || clientId <= 0)
    return false

  const sql = sqlHelpers(getDatabaseDialect())
  const lock = sql.isSqlite ? '' : ' FOR UPDATE'
  const disabled = await db.transaction(async (rawTrx) => {
    const trx = rawTrx as unknown as { unsafe: (statement: string, params?: unknown[]) => Promise<unknown> }
    const rows = await trx.unsafe(`
      SELECT id, revoked FROM oauth_clients
      WHERE id = ${sql.param(1)} AND user_id = ${sql.param(2)}
      LIMIT 1${lock}
    `, [clientId, ownerId]) as unknown as Array<{ id: number | string, revoked: boolean | number }>
    if (!rows[0] || !inactive(rows[0].revoked))
      return false

    const now = sqlDateTime(new Date())
    const revoked = sql.isPostgres ? true : 1
    const active = sql.isPostgres ? false : 0
    const changed = await trx.unsafe(`
      UPDATE oauth_clients
      SET revoked = ${sql.param(1)}, updated_at = ${sql.param(2)}
      WHERE id = ${sql.param(3)} AND user_id = ${sql.param(4)} AND revoked = ${sql.param(5)}
    `, [revoked, now, clientId, ownerId, active])
    if (mutationCount(changed) !== 1)
      return false

    await trx.unsafe(`
      UPDATE oauth_grants
      SET revoked_at = ${sql.param(1)}, updated_at = ${sql.param(2)}
      WHERE client_id = ${sql.param(3)} AND revoked_at IS NULL
    `, [now, now, clientId])
    await trx.unsafe(`
      UPDATE oauth_auth_codes
      SET consumed_at = ${sql.param(1)}
      WHERE client_id = ${sql.param(2)} AND consumed_at IS NULL
    `, [now, clientId])
    await trx.unsafe(`
      UPDATE oauth_authorization_requests
      SET consumed_at = ${sql.param(1)}
      WHERE client_id = ${sql.param(2)} AND consumed_at IS NULL
    `, [now, clientId])
    await trx.unsafe(`
      UPDATE oauth_refresh_tokens
      SET revoked = ${sql.param(1)}
      WHERE access_token_id IN (
        SELECT id FROM oauth_access_tokens WHERE oauth_client_id = ${sql.param(2)}
      )
    `, [revoked, clientId])
    await trx.unsafe(`
      UPDATE oauth_access_tokens
      SET revoked = ${sql.param(1)}, updated_at = ${sql.param(2)}
      WHERE oauth_client_id = ${sql.param(3)}
    `, [revoked, now, clientId])
    return true
  })
  if (disabled)
    markContextWrote()
  return disabled
}
