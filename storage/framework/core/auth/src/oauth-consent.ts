import type { OAuthAuthorizationRequestSessionResult } from './oauth-authorization-requests'
import type { ResolvedOAuthProviderConfig } from './oauth-provider'
import {
  assertOAuthAuthorizationProviderPolicy,
  OAuthAuthorizationRequestError,
  type ValidatedOAuthAuthorizationRequest,
  validateOAuthAuthorizationRequest,
} from './oauth-authorization'
import { db, getDatabaseDialect, parseSqlDateTime, sqlDateTime, sqlHelpers } from '@stacksjs/database/runtime'
import { issueAuthorizationCode } from './oauth-authorization-codes'
import {
  isOAuthAuthorizationRequestId,
  loadOAuthAuthorizationRequestSession,
  withOAuthAuthorizationRequestSession,
} from './oauth-authorization-requests'
import { loadOAuthAuthorizationClient, loadOAuthAuthorizationClientDetails } from './oauth-client-registration'
import { createOAuthGrant } from './oauth-grants'

export interface ApproveOAuthAuthorizationRequestSessionInput {
  provider: ResolvedOAuthProviderConfig
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

export interface ReuseOAuthAuthorizationRequestSessionInput {
  provider: ResolvedOAuthProviderConfig
  requestId: string
  browserSessionId: string
  subjectType: string
  subjectId: number
  workspaceId?: string | null
  /** Recheck current workspace authority inside the reuse transaction. */
  resolveWorkspaceId?: () => Promise<string | null>
}

export interface LoadOAuthAuthorizationConsentViewInput {
  provider: ResolvedOAuthProviderConfig
  requestId: string
  browserSessionId: string
}

export interface OAuthAuthorizationConsentView {
  requestId: string
  client: {
    id: string
    name: string
    type: 'confidential' | 'public'
  }
  permissions: Array<{
    name: string
    description: string
  }>
  resources: Array<{
    name: string
    audience: string
    description?: string
  }>
}

export interface OAuthAuthorizationConsentRequest {
  requestId: string
  decision: 'approve' | 'deny'
}

export class OAuthAuthorizationConsentRequestError extends Error {
  readonly code = 'invalid_request' as const

  constructor(message: string) {
    super(message)
    this.name = 'OAuthAuthorizationConsentRequestError'
  }
}

interface StoredRememberedConsent {
  id: string
  scopes: string
  resources: string
  audiences: string
  created_at: string | Date
}

class NoReusableOAuthConsentError extends Error {}

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

function consentParameter(params: URLSearchParams, name: string): string {
  const values = params.getAll(name)
  if (values.length !== 1 || values[0] === '')
    throw new OAuthAuthorizationConsentRequestError(`OAuth consent parameter must appear exactly once: ${name}`)
  return values[0]!
}

/** Parse only the opaque handle and decision from a CSRF-verified form body. */
export function parseOAuthAuthorizationConsentRequest(
  body: string | URLSearchParams,
): OAuthAuthorizationConsentRequest {
  const encoded = typeof body === 'string' ? body : body.toString()
  if (encoded.length > 4096)
    throw new OAuthAuthorizationConsentRequestError('OAuth consent request is too large.')

  const params = typeof body === 'string' ? new URLSearchParams(body) : body
  const requestId = consentParameter(params, 'request_id')
  const decision = consentParameter(params, 'decision')
  if (!isOAuthAuthorizationRequestId(requestId))
    throw new OAuthAuthorizationConsentRequestError('OAuth consent request identifier is invalid.')
  if (decision !== 'approve' && decision !== 'deny')
    throw new OAuthAuthorizationConsentRequestError('OAuth consent decision is invalid.')
  return { requestId, decision }
}

/** Build consent-safe display data without returning callback or PKCE fields. */
export async function loadOAuthAuthorizationConsentView(
  input: LoadOAuthAuthorizationConsentViewInput,
): Promise<OAuthAuthorizationConsentView | null> {
  const request = await loadOAuthAuthorizationRequestSession(input.requestId, input.browserSessionId)
  if (!request)
    return null
  const client = await loadOAuthAuthorizationClientDetails(request.clientId)
  if (!client)
    return null

  let current: ValidatedOAuthAuthorizationRequest
  try {
    current = validateOAuthAuthorizationRequest(input.provider, client, {
      responseType: request.responseType,
      clientId: request.clientId,
      redirectUri: request.redirectUri,
      scope: request.scopes.join(' '),
      resource: request.audiences,
      ...(request.state === null ? {} : { state: request.state }),
      codeChallenge: request.codeChallenge,
      codeChallengeMethod: request.codeChallengeMethod,
    })
  }
  catch (error) {
    if (error instanceof OAuthAuthorizationRequestError)
      return null
    throw error
  }

  const permissions: OAuthAuthorizationConsentView['permissions'] = []
  for (const name of current.scopes) {
    const scope = input.provider.scopes[name]
    if (!scope)
      return null
    permissions.push({ name, description: scope.description })
  }
  const resources: OAuthAuthorizationConsentView['resources'] = []
  for (const [index, name] of current.resources.entries()) {
    const resource = input.provider.resources[name]
    const audience = current.audiences[index]
    if (!resource || !audience)
      return null
    resources.push({
      name,
      audience,
      ...(resource.description === undefined ? {} : { description: resource.description }),
    })
  }

  return {
    requestId: input.requestId,
    client: { id: current.clientId, name: client.name, type: current.clientType },
    permissions,
    resources,
  }
}

async function reusableOAuthConsentGrantId(
  input: ReusableOAuthConsentInput,
  options: { exact?: boolean, lock?: boolean } = {},
): Promise<string | null> {
  if (!Number.isFinite(input.rememberForMs) || input.rememberForMs <= 0
    || !Number.isSafeInteger(input.subjectId) || input.subjectId <= 0
    || !/^[A-Za-z0-9_.:-]{1,255}$/.test(input.subjectType)
    || (input.workspaceId != null && (!input.workspaceId || input.workspaceId.length > 255)))
    return null

  const clientId = Number(input.request.clientId)
  const cutoff = new Date(Date.now() - input.rememberForMs)
  if (!Number.isSafeInteger(clientId) || clientId <= 0 || !Number.isFinite(cutoff.getTime()))
    return null

  const client = await loadOAuthAuthorizationClient(input.request.clientId)
  if (!client || client.revoked || client.type !== input.request.clientType
    || !client.redirectUris.includes(input.request.redirectUri)
    || !client.grantTypes.includes('authorization_code')
    || !includesAll(client.scopes, input.request.scopes)
    || !includesAll(client.resources, input.request.resources))
    return null

  const sql = sqlHelpers(getDatabaseDialect())
  const params: unknown[] = [clientId, input.subjectType, input.subjectId, sqlDateTime(cutoff)]
  const workspace = input.workspaceId ?? null
  const workspacePredicate = workspace === null
    ? 'g.workspace_id IS NULL'
    : `g.workspace_id = ${sql.param(params.push(workspace))}`
  const lock = options.lock
    ? sql.isPostgres ? ' FOR SHARE' : sql.isMysql ? ' LOCK IN SHARE MODE' : ''
    : ''
  const rows = await db.primary.unsafe(`
    SELECT g.id, g.scopes, g.resources, g.audiences, g.created_at
    FROM oauth_grants g
    JOIN oauth_clients c ON c.id = g.client_id AND c.revoked = ${sql.boolFalse}
    WHERE g.client_id = ${sql.param(1)}
      AND g.subject_type = ${sql.param(2)}
      AND g.subject_id = ${sql.param(3)}
      AND g.revoked_at IS NULL
      AND g.created_at >= ${sql.param(4)}
      AND ${workspacePredicate}
    ORDER BY g.created_at DESC, g.id DESC${lock}
  `, params) as unknown as StoredRememberedConsent[]

  for (const row of rows) {
    const grantId = String(row.id)
    const scopes = storedValues(row.scopes)
    const resources = storedValues(row.resources)
    const audiences = storedValues(row.audiences)
    const createdAt = parseSqlDateTime(row.created_at)?.getTime() ?? 0
    const covers = /^[a-f0-9]{32}$/.test(grantId)
      && createdAt >= cutoff.getTime()
      && scopes !== null
      && resources !== null
      && audiences !== null
      && includesAll(scopes, input.request.scopes)
      && includesResourceBindings(resources, audiences, input.request.resources, input.request.audiences)
    if (!covers)
      continue
    if (options.exact && (JSON.stringify(scopes) !== JSON.stringify(input.request.scopes)
      || JSON.stringify(resources) !== JSON.stringify(input.request.resources)
      || JSON.stringify(audiences) !== JSON.stringify(input.request.audiences)))
      continue
    return grantId
  }
  return null
}

/** Whether a recent active grant already covers the requested consent. */
export async function hasReusableOAuthConsent(input: ReusableOAuthConsentInput): Promise<boolean> {
  return await reusableOAuthConsentGrantId(input) !== null
}

/** Reuse one exact remembered grant without creating a duplicate connection. */
export async function reuseOAuthAuthorizationRequestSession(
  input: ReuseOAuthAuthorizationRequestSessionInput,
): Promise<OAuthAuthorizationRequestSessionResult<OAuthAuthorizationConsentResult> | null> {
  if (input.provider.consent.rememberFor <= 0)
    return null

  try {
    return await withOAuthAuthorizationRequestSession(input.requestId, input.browserSessionId, async (request) => {
      assertOAuthAuthorizationProviderPolicy(input.provider, request)
      const workspaceId = input.resolveWorkspaceId
        ? await input.resolveWorkspaceId()
        : input.workspaceId
      const grantId = await reusableOAuthConsentGrantId({
        request,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        workspaceId,
        rememberForMs: input.provider.consent.rememberFor,
      }, { exact: true, lock: true })
      if (!grantId)
        throw new NoReusableOAuthConsentError()

      const code = await issueAuthorizationCode({
        grantId,
        redirectUri: request.redirectUri,
        codeChallenge: request.codeChallenge,
        lifetimeMs: input.provider.lifetimes.authorizationCode,
      })
      return {
        code,
        grantId,
        redirectUri: request.redirectUri,
        state: request.state,
      }
    })
  }
  catch (error) {
    if (error instanceof NoReusableOAuthConsentError)
      return null
    throw error
  }
}

/** Atomically turn one authenticated browser approval into a grant and code. */
export async function approveOAuthAuthorizationRequestSession(
  input: ApproveOAuthAuthorizationRequestSessionInput,
): Promise<OAuthAuthorizationRequestSessionResult<OAuthAuthorizationConsentResult>> {
  if (!Number.isSafeInteger(input.authorizationCodeLifetimeMs) || input.authorizationCodeLifetimeMs <= 0)
    throw new TypeError('OAuth authorization code lifetime must be a positive safe integer.')

  return withOAuthAuthorizationRequestSession(input.requestId, input.browserSessionId, async (request) => {
    assertOAuthAuthorizationProviderPolicy(input.provider, request)
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
