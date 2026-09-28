import type { OAuthAuthorizationRequestSessionResult } from './oauth-authorization-requests'
import type { ValidatedOAuthAuthorizationRequest } from './oauth-authorization'
import { db, getDatabaseDialect, parseSqlDateTime, sqlDateTime, sqlHelpers } from '@stacksjs/database/runtime'
import { issueAuthorizationCode } from './oauth-authorization-codes'
import { withOAuthAuthorizationRequestSession } from './oauth-authorization-requests'
import { loadOAuthAuthorizationClient } from './oauth-client-registration'
import { createOAuthGrant } from './oauth-grants'

export interface ApproveOAuthAuthorizationRequestSessionInput {
  requestId: string
  browserSessionId: string
  subjectType: string
  subjectId: number
  workspaceId?: string | null
  authorizationCodeLifetimeMs: number
}

export interface OAuthAuthorizationConsentResult {
  code: string
  grantId: string
  redirectUri: string
  state: string | null
}

export interface OAuthAuthorizationDenialResult {
  error: 'access_denied'
  redirectUri: string
  state: string | null
}

export interface ReusableOAuthConsentInput {
  request: ValidatedOAuthAuthorizationRequest
  subjectType: string
  subjectId: number
  workspaceId?: string | null
  rememberForMs: number
}

interface StoredRememberedConsent {
  scopes: string
  resources: string
  audiences: string
  created_at: string | Date
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

function includesAll(approved: readonly string[], requested: readonly string[]): boolean {
  return requested.every(value => approved.includes(value))
}

function includesResourceBindings(
  approvedResources: readonly string[],
  approvedAudiences: readonly string[],
  requestedResources: readonly string[],
  requestedAudiences: readonly string[],
): boolean {
  if (approvedResources.length !== approvedAudiences.length || requestedResources.length !== requestedAudiences.length)
    return false
  return requestedResources.every((resource, index) => {
    const approvedIndex = approvedResources.indexOf(resource)
    return approvedIndex >= 0 && approvedAudiences[approvedIndex] === requestedAudiences[index]
  })
}

/** Whether a recent active grant already covers the requested consent. */
export async function hasReusableOAuthConsent(input: ReusableOAuthConsentInput): Promise<boolean> {
  if (!Number.isFinite(input.rememberForMs) || input.rememberForMs <= 0
    || !Number.isSafeInteger(input.subjectId) || input.subjectId <= 0
    || !/^[A-Za-z0-9_.:-]{1,255}$/.test(input.subjectType)
    || (input.workspaceId != null && (!input.workspaceId || input.workspaceId.length > 255)))
    return false

  const clientId = Number(input.request.clientId)
  const cutoff = new Date(Date.now() - input.rememberForMs)
  if (!Number.isSafeInteger(clientId) || clientId <= 0 || !Number.isFinite(cutoff.getTime()))
    return false

  const client = await loadOAuthAuthorizationClient(input.request.clientId)
  if (!client || client.revoked || client.type !== input.request.clientType
    || !client.redirectUris.includes(input.request.redirectUri)
    || !client.grantTypes.includes('authorization_code')
    || !includesAll(client.scopes, input.request.scopes)
    || !includesAll(client.resources, input.request.resources))
    return false

  const sql = sqlHelpers(getDatabaseDialect())
  const params: unknown[] = [clientId, input.subjectType, input.subjectId, sqlDateTime(cutoff)]
  const workspace = input.workspaceId ?? null
  const workspacePredicate = workspace === null
    ? 'g.workspace_id IS NULL'
    : `g.workspace_id = ${sql.param(params.push(workspace))}`
  const rows = await db.primary.unsafe(`
    SELECT g.scopes, g.resources, g.audiences, g.created_at
    FROM oauth_grants g
    JOIN oauth_clients c ON c.id = g.client_id AND c.revoked = ${sql.boolFalse}
    WHERE g.client_id = ${sql.param(1)}
      AND g.subject_type = ${sql.param(2)}
      AND g.subject_id = ${sql.param(3)}
      AND g.revoked_at IS NULL
      AND g.created_at >= ${sql.param(4)}
      AND ${workspacePredicate}
    ORDER BY g.created_at DESC, g.id DESC
  `, params) as unknown as StoredRememberedConsent[]

  return rows.some((row) => {
    const scopes = storedValues(row.scopes)
    const resources = storedValues(row.resources)
    const audiences = storedValues(row.audiences)
    const createdAt = parseSqlDateTime(row.created_at)?.getTime() ?? 0
    return createdAt >= cutoff.getTime()
      && scopes !== null
      && resources !== null
      && audiences !== null
      && includesAll(scopes, input.request.scopes)
      && includesResourceBindings(resources, audiences, input.request.resources, input.request.audiences)
  })
}

/** Atomically turn one authenticated browser approval into a grant and code. */
export async function approveOAuthAuthorizationRequestSession(
  input: ApproveOAuthAuthorizationRequestSessionInput,
): Promise<OAuthAuthorizationRequestSessionResult<OAuthAuthorizationConsentResult>> {
  if (!Number.isSafeInteger(input.authorizationCodeLifetimeMs) || input.authorizationCodeLifetimeMs <= 0)
    throw new TypeError('OAuth authorization code lifetime must be a positive safe integer.')

  return withOAuthAuthorizationRequestSession(input.requestId, input.browserSessionId, async (request) => {
    const grant = await createOAuthGrant({
      clientId: Number(request.clientId),
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      scopes: request.scopes,
      resources: request.resources,
      audiences: request.audiences,
      workspaceId: input.workspaceId,
    })
    const code = await issueAuthorizationCode({
      grantId: grant.id,
      redirectUri: request.redirectUri,
      codeChallenge: request.codeChallenge,
      lifetimeMs: input.authorizationCodeLifetimeMs,
    })
    return {
      code,
      grantId: grant.id,
      redirectUri: request.redirectUri,
      state: request.state,
    }
  })
}

/** Consume one browser-bound denial without creating a grant or authorization code. */
export async function denyOAuthAuthorizationRequestSession(
  requestId: string,
  browserSessionId: string,
): Promise<OAuthAuthorizationRequestSessionResult<OAuthAuthorizationDenialResult>> {
  return withOAuthAuthorizationRequestSession(requestId, browserSessionId, async request => ({
    error: 'access_denied' as const,
    redirectUri: request.redirectUri,
    state: request.state,
  }))
}
