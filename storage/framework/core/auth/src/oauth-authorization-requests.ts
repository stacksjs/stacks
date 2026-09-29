import {
  isValidOAuthRedirectUri,
  isValidOAuthState,
  type ValidatedOAuthAuthorizationRequest,
} from './oauth-authorization'
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
import { loadOAuthAuthorizationClient } from './oauth-client-registration'
import { isValidS256CodeChallenge } from './oauth-pkce'

interface StoredAuthorizationRequest {
  client_id: number | string
  client_type: string
  redirect_uri: string
  scopes: string
  resources: string
  audiences: string
  workspace_id: string | null
  workspace_bound: boolean | number
  state: string | null
  code_challenge: string
  code_challenge_method: string
  expires_at: string | Date
  consumed_at: string | Date | null
}

interface StoredAuthorizationClientPolicy {
  id: number | string
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
}

export type OAuthAuthorizationRequestSessionResult<T>
  = | { ok: true, value: T }
    | { ok: false, reason: 'invalid_request' }

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/
const invalidRequest = { ok: false as const, reason: 'invalid_request' as const }

export interface OAuthAuthorizationRequestWorkspaceBinding {
  bound: boolean
  id: string | null
}

export function isOAuthAuthorizationRequestId(value: string): boolean {
  return REQUEST_ID_PATTERN.test(value)
}

function requestHash(value: string): string {
  return createHash('sha256').update(value, 'ascii').digest('hex')
}

function browserSessionHash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function validBrowserSession(value: string): boolean {
  return value.length >= 16 && value.length <= 4096
}

function validValues(values: readonly string[]): boolean {
  return values.every(value => value.length > 0) && new Set(values).size === values.length
}

function storedValues(value: string | null): string[] | null {
  if (value == null) return null
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed)
      && parsed.every(item => typeof item === 'string')
      && validValues(parsed)
      ? parsed
      : null
  }
  catch {
    return null
  }
}

function includesAll(allowed: readonly string[], requested: readonly string[]): boolean {
  return requested.every(value => allowed.includes(value))
}

function inactive(value: boolean | number): boolean {
  return value === false || value === 0
}

function workspaceBindingFromStoredRow(
  row: StoredAuthorizationRequest,
): OAuthAuthorizationRequestWorkspaceBinding | null {
  const bound = row.workspace_bound === true || row.workspace_bound === 1
  if (!bound && !inactive(row.workspace_bound))
    return null
  if (row.workspace_id !== null
    && (!row.workspace_id || row.workspace_id.length > 255 || /[\u0000-\u001F\u007F]/.test(row.workspace_id)))
    return null
  if (!bound && row.workspace_id !== null)
    return null
  return { bound, id: row.workspace_id }
}

function requestFromStoredRow(row: StoredAuthorizationRequest, now: number): ValidatedOAuthAuthorizationRequest | null {
  const clientId = Number(row.client_id)
  if (!Number.isSafeInteger(clientId) || clientId <= 0
    || (row.client_type !== 'public' && row.client_type !== 'confidential')
    || !isValidOAuthRedirectUri(row.redirect_uri)
    || row.code_challenge_method !== 'S256'
    || !isValidS256CodeChallenge(row.code_challenge)
    || (parseSqlDateTime(row.expires_at)?.getTime() ?? 0) <= now
    || row.consumed_at != null
    || (row.state != null && !isValidOAuthState(row.state)))
    return null

  const scopes = storedValues(row.scopes)
  const resources = storedValues(row.resources)
  const audiences = storedValues(row.audiences)
  if (!scopes?.length || !resources || !audiences || resources.length !== audiences.length)
    return null

  return {
    responseType: 'code',
    clientId: String(clientId),
    clientType: row.client_type,
    redirectUri: row.redirect_uri,
    scopes,
    resources,
    audiences,
    state: row.state,
    codeChallenge: row.code_challenge,
    codeChallengeMethod: 'S256',
  }
}

function policyAllowsRequest(
  row: StoredAuthorizationClientPolicy | undefined,
  request: ValidatedOAuthAuthorizationRequest,
): boolean {
  if (!row || String(row.id) !== request.clientId)
    return false
  const redirectUris = storedValues(row.redirect_uris)
  const grantTypes = storedValues(row.grant_types)
  const scopes = storedValues(row.allowed_scopes)
  const resources = storedValues(row.allowed_resources)
  const method = row.token_endpoint_auth_method
  if (!redirectUris?.length || !grantTypes?.includes('authorization_code') || !scopes?.length || !resources)
    return false
  return row.client_type === request.clientType
    && inactive(row.revoked)
    && inactive(row.personal_access_client)
    && inactive(row.password_client)
    && ((row.client_type === 'public' && method === 'none' && row.secret == null)
      || (row.client_type === 'confidential' && method === 'client_secret_basic' && Boolean(row.secret)))
    && redirectUris.includes(request.redirectUri)
    && row.redirect === redirectUris[0]
    && new Set(redirectUris).size === redirectUris.length
    && new Set(grantTypes).size === grantTypes.length
    && new Set(scopes).size === scopes.length
    && new Set(resources).size === resources.length
    && redirectUris.every(isValidOAuthRedirectUri)
    && includesAll(scopes, request.scopes)
    && includesAll(resources, request.resources)
}

/** Store one validated authorization request behind an opaque, hashed handle. */
export async function createOAuthAuthorizationRequestSession(
  request: ValidatedOAuthAuthorizationRequest,
  browserSessionId: string,
  lifetimeMs: number,
): Promise<string> {
  const clientId = Number(request.clientId)
  if (!Number.isSafeInteger(clientId) || clientId <= 0)
    throw new TypeError('OAuth authorization request client identifier is invalid.')
  if (!validBrowserSession(browserSessionId))
    throw new TypeError('OAuth authorization request requires a valid browser session identifier.')
  if (!Number.isSafeInteger(lifetimeMs) || lifetimeMs <= 0)
    throw new TypeError('OAuth authorization request lifetime must be a positive safe integer.')
  if (request.state != null && !isValidOAuthState(request.state))
    throw new TypeError('OAuth authorization request state must contain 1 to 4096 visible ASCII characters.')
  if (!request.scopes.length || !validValues(request.scopes))
    throw new TypeError('OAuth authorization request scopes must contain unique non-empty values.')
  if (!validValues(request.resources) || !validValues(request.audiences)
    || request.resources.length !== request.audiences.length)
    throw new TypeError('OAuth authorization request resources and audiences must contain unique paired values.')
  if (!isValidOAuthRedirectUri(request.redirectUri)
    || !isValidS256CodeChallenge(request.codeChallenge)
    || request.codeChallengeMethod !== 'S256'
    || request.resources.length !== request.audiences.length)
    throw new TypeError('OAuth authorization request is invalid.')

  const registered = await loadOAuthAuthorizationClient(request.clientId)
  if (!registered || registered.revoked
    || registered.type !== request.clientType
    || !registered.redirectUris.includes(request.redirectUri)
    || !registered.grantTypes.includes('authorization_code')
    || !includesAll(registered.scopes, request.scopes)
    || !includesAll(registered.resources, request.resources))
    throw new Error('OAuth client registration no longer authorizes this request.')

  const id = randomBytes(32).toString('base64url')
  const createdAt = new Date()
  const expiresAt = new Date(createdAt.getTime() + lifetimeMs)
  if (!Number.isFinite(expiresAt.getTime()))
    throw new TypeError('OAuth authorization request lifetime is outside the supported date range.')
  const sql = sqlHelpers(getDatabaseDialect())
  if (sql.isMysql) {
    createdAt.setUTCMilliseconds(0)
    expiresAt.setUTCMilliseconds(0)
  }
  if (expiresAt.getTime() <= createdAt.getTime())
    throw new TypeError('OAuth authorization request lifetime is below database timestamp precision.')
  const values = sql.params(
    requestHash(id),
    browserSessionHash(browserSessionId),
    clientId,
    request.clientType,
    request.redirectUri,
    JSON.stringify(request.scopes),
    JSON.stringify(request.resources),
    JSON.stringify(request.audiences),
    request.state,
    request.codeChallenge,
    request.codeChallengeMethod,
    sqlDateTime(expiresAt),
    sqlDateTime(createdAt),
  )
  await db.unsafe(`
    INSERT INTO oauth_authorization_requests (
      request_hash, browser_session_hash, client_id, client_type, redirect_uri,
      scopes, resources, audiences, state, code_challenge, code_challenge_method,
      expires_at, created_at
    ) VALUES (${values.sql})
  `, values.values)
  markContextWrote()
  return id
}

/** Reload a request only for its original browser and current client policy. */
export async function loadOAuthAuthorizationRequestSession(
  requestId: string,
  browserSessionId: string,
): Promise<ValidatedOAuthAuthorizationRequest | null> {
  if (!isOAuthAuthorizationRequestId(requestId) || !validBrowserSession(browserSessionId))
    return null

  const sql = sqlHelpers(getDatabaseDialect())
  const rows = await db.primary.unsafe(`
    SELECT client_id, client_type, redirect_uri, scopes, resources, audiences, workspace_id, workspace_bound,
      state, code_challenge, code_challenge_method, expires_at, consumed_at
    FROM oauth_authorization_requests
    WHERE request_hash = ${sql.param(1)}
      AND browser_session_hash = ${sql.param(2)}
      AND consumed_at IS NULL
      AND expires_at > ${sql.param(3)}
    LIMIT 1
  `, [requestHash(requestId), browserSessionHash(browserSessionId), sqlDateTime(new Date())]) as unknown as StoredAuthorizationRequest[]
  const row = rows[0]
  if (!row)
    return null
  const request = requestFromStoredRow(row, Date.now())
  const workspace = workspaceBindingFromStoredRow(row)
  const registered = await loadOAuthAuthorizationClient(String(row.client_id))
  if (!request || !workspace || !registered || registered.revoked || registered.type !== request.clientType
    || !registered.redirectUris.includes(request.redirectUri)
    || !registered.grantTypes.includes('authorization_code')
    || !includesAll(registered.scopes, request.scopes)
    || !includesAll(registered.resources, request.resources))
    return null

  return request
}

/** Bind the opaque request to the workspace displayed on its consent page. */
export async function bindOAuthAuthorizationRequestWorkspace(
  requestId: string,
  browserSessionId: string,
  workspaceId: string | null,
): Promise<boolean> {
  if (!isOAuthAuthorizationRequestId(requestId) || !validBrowserSession(browserSessionId)
    || (workspaceId !== null
      && (!workspaceId || workspaceId.length > 255 || /[\u0000-\u001F\u007F]/.test(workspaceId))))
    return false

  const sql = sqlHelpers(getDatabaseDialect())
  const hash = requestHash(requestId)
  const sessionHash = browserSessionHash(browserSessionId)
  const requestLock = sql.isSqlite ? '' : ' FOR UPDATE'
  const result = await db.transaction(async (rawTrx) => {
    const trx = rawTrx as unknown as { unsafe: (statement: string, params?: unknown[]) => Promise<unknown> }
    const now = sqlDateTime(new Date())
    const rows = await trx.unsafe(`
      SELECT workspace_id, workspace_bound, expires_at, consumed_at
      FROM oauth_authorization_requests
      WHERE request_hash = ${sql.param(1)}
        AND browser_session_hash = ${sql.param(2)}
      LIMIT 1${requestLock}
    `, [hash, sessionHash]) as unknown as StoredAuthorizationRequest[]
    const row = rows[0]
    const binding = row ? workspaceBindingFromStoredRow(row) : null
    if (!row || !binding || row.consumed_at != null
      || (parseSqlDateTime(row.expires_at)?.getTime() ?? 0) <= Date.now())
      return { matches: false, wrote: false }
    if (binding.bound)
      return { matches: binding.id === workspaceId, wrote: false }

    const updated = await trx.unsafe(`
      UPDATE oauth_authorization_requests
      SET workspace_id = ${sql.param(1)}, workspace_bound = ${sql.boolTrue}
      WHERE request_hash = ${sql.param(2)}
        AND browser_session_hash = ${sql.param(3)}
        AND workspace_bound = ${sql.boolFalse}
        AND consumed_at IS NULL
        AND expires_at > ${sql.param(4)}
    `, [workspaceId, hash, sessionHash, now])
    const wrote = mutationCount(updated) === 1
    return { matches: wrote, wrote }
  })
  if (result.wrote)
    markContextWrote()
  return result.matches
}

/** Claim one browser-bound request and complete consent in the same transaction. */
export async function withOAuthAuthorizationRequestSession<T>(
  requestId: string,
  browserSessionId: string,
  complete: (
    request: ValidatedOAuthAuthorizationRequest,
    workspace: OAuthAuthorizationRequestWorkspaceBinding,
  ) => Promise<T>,
): Promise<OAuthAuthorizationRequestSessionResult<T>> {
  if (!isOAuthAuthorizationRequestId(requestId) || !validBrowserSession(browserSessionId))
    return invalidRequest

  const sql = sqlHelpers(getDatabaseDialect())
  const hash = requestHash(requestId)
  const sessionHash = browserSessionHash(browserSessionId)
  const requestLock = sql.isSqlite ? '' : ' FOR UPDATE'
  const clientLock = sql.isPostgres ? ' FOR SHARE' : sql.isMysql ? ' LOCK IN SHARE MODE' : ''
  const result = await db.transaction(async (rawTrx): Promise<OAuthAuthorizationRequestSessionResult<T>> => {
    const trx = rawTrx as unknown as { unsafe: (statement: string, params?: unknown[]) => Promise<unknown> }
    const now = new Date()
    const nowSql = sqlDateTime(now)
    const rows = await trx.unsafe(`
      SELECT client_id, client_type, redirect_uri, scopes, resources, audiences, workspace_id, workspace_bound,
        state, code_challenge, code_challenge_method, expires_at, consumed_at
      FROM oauth_authorization_requests
      WHERE request_hash = ${sql.param(1)}
        AND browser_session_hash = ${sql.param(2)}
      LIMIT 1${requestLock}
    `, [hash, sessionHash]) as unknown as StoredAuthorizationRequest[]
    const request = rows[0] ? requestFromStoredRow(rows[0], now.getTime()) : null
    const workspace = rows[0] ? workspaceBindingFromStoredRow(rows[0]) : null
    if (!request || !workspace)
      return invalidRequest

    const clients = await trx.unsafe(`
      SELECT id, secret, redirect, client_type, redirect_uris, grant_types,
        token_endpoint_auth_method, allowed_scopes, allowed_resources,
        personal_access_client, password_client, revoked
      FROM oauth_clients
      WHERE id = ${sql.param(1)}
      LIMIT 1${clientLock}
    `, [Number(request.clientId)]) as StoredAuthorizationClientPolicy[]
    if (!policyAllowsRequest(clients[0], request))
      return invalidRequest

    const claimed = await trx.unsafe(`
      UPDATE oauth_authorization_requests
      SET consumed_at = ${sql.param(1)}
      WHERE request_hash = ${sql.param(2)}
        AND browser_session_hash = ${sql.param(3)}
        AND consumed_at IS NULL
        AND expires_at > ${sql.param(4)}
    `, [nowSql, hash, sessionHash, nowSql])
    if (mutationCount(claimed) !== 1)
      return invalidRequest

    return { ok: true, value: await complete(request, workspace) }
  })
  if (result.ok)
    markContextWrote()
  return result
}
