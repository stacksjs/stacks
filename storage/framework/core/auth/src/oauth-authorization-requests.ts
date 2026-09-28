import type { ValidatedOAuthAuthorizationRequest } from './oauth-authorization'
import { createHash, randomBytes } from 'node:crypto'
import {
  db,
  getDatabaseDialect,
  markContextWrote,
  parseSqlDateTime,
  sqlDateTime,
  sqlHelpers,
} from '@stacksjs/database/runtime'
import { isValidOAuthRedirectUri } from './oauth-authorization'
import { loadOAuthAuthorizationClient } from './oauth-client-registration'
import { isValidS256CodeChallenge } from './oauth-pkce'

interface StoredAuthorizationRequest {
  client_id: number | string
  client_type: string
  redirect_uri: string
  scopes: string
  resources: string
  audiences: string
  state: string | null
  code_challenge: string
  code_challenge_method: string
  expires_at: string | Date
  consumed_at: string | Date | null
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/

function requestHash(value: string): string {
  return createHash('sha256').update(value, 'ascii').digest('hex')
}

function browserSessionHash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function validBrowserSession(value: string): boolean {
  return value.length >= 16 && value.length <= 4096
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

function includesAll(allowed: readonly string[], requested: readonly string[]): boolean {
  return requested.every(value => allowed.includes(value))
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
  if (request.state != null && request.state.length > 4096)
    throw new TypeError('OAuth authorization request state exceeds 4096 characters.')
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
  if (!REQUEST_ID_PATTERN.test(requestId) || !validBrowserSession(browserSessionId))
    return null

  const sql = sqlHelpers(getDatabaseDialect())
  const rows = await db.primary.unsafe(`
    SELECT client_id, client_type, redirect_uri, scopes, resources, audiences,
      state, code_challenge, code_challenge_method, expires_at, consumed_at
    FROM oauth_authorization_requests
    WHERE request_hash = ${sql.param(1)}
      AND browser_session_hash = ${sql.param(2)}
      AND consumed_at IS NULL
      AND expires_at > ${sql.param(3)}
    LIMIT 1
  `, [requestHash(requestId), browserSessionHash(browserSessionId), sqlDateTime(new Date())]) as StoredAuthorizationRequest[]
  const row = rows[0]
  if (!row || row.consumed_at != null
    || (row.client_type !== 'public' && row.client_type !== 'confidential')
    || !isValidOAuthRedirectUri(row.redirect_uri)
    || row.code_challenge_method !== 'S256'
    || !isValidS256CodeChallenge(row.code_challenge)
    || (parseSqlDateTime(row.expires_at)?.getTime() ?? 0) <= Date.now())
    return null

  const scopes = storedValues(row.scopes)
  const resources = storedValues(row.resources)
  const audiences = storedValues(row.audiences)
  const registered = await loadOAuthAuthorizationClient(String(row.client_id))
  if (!scopes || !resources || !audiences || resources.length !== audiences.length
    || !registered || registered.revoked || registered.type !== row.client_type
    || !registered.redirectUris.includes(row.redirect_uri)
    || !registered.grantTypes.includes('authorization_code')
    || !includesAll(registered.scopes, scopes)
    || !includesAll(registered.resources, resources))
    return null

  return {
    responseType: 'code',
    clientId: String(row.client_id),
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
