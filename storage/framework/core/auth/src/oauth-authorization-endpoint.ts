import type { ResolvedOAuthProviderConfig } from './oauth-provider'
import {
  OAuthAuthorizationRequestError,
  parseOAuthAuthorizationRequest,
  validateOAuthAuthorizationRequest,
} from './oauth-authorization'
import { createOAuthAuthorizationRequestSession } from './oauth-authorization-requests'
import { loadOAuthAuthorizationClient } from './oauth-client-registration'
import {
  approveOAuthAuthorizationRequestSession,
  denyOAuthAuthorizationRequestSession,
  OAuthAuthorizationConsentRequestError,
  parseOAuthAuthorizationConsentRequest,
} from './oauth-consent'
import { oauthAuthorizationConsentResponse } from './oauth-authorization-response'

export interface BeginOAuthAuthorizationRequestInput {
  provider: ResolvedOAuthProviderConfig
  query: string | URLSearchParams
  browserSessionId: string
}

export interface BegunOAuthAuthorizationRequest {
  /** The only value that login and consent forms need to preserve. */
  requestId: string
}

export interface HandleOAuthAuthorizationConsentRequestInput {
  provider: ResolvedOAuthProviderConfig
  request: Request
  browserSessionId: string
  subjectType: string
  subjectId: number
  workspaceId?: string | null
}

const LOCAL_ERROR_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'Pragma': 'no-cache',
  'Referrer-Policy': 'no-referrer',
} as const

function localAuthorizationError(status: number): Response {
  return new Response(JSON.stringify({ error: 'invalid_request' }), {
    status,
    headers: LOCAL_ERROR_HEADERS,
  })
}

/** Validate and persist one browser authorization request behind an opaque handle. */
export async function beginOAuthAuthorizationRequest(
  input: BeginOAuthAuthorizationRequestInput,
): Promise<BegunOAuthAuthorizationRequest> {
  const parsed = parseOAuthAuthorizationRequest(input.query)
  const client = await loadOAuthAuthorizationClient(parsed.clientId)
  if (!client)
    throw new OAuthAuthorizationRequestError('invalid_request', 'OAuth authorization request is invalid.')

  const request = validateOAuthAuthorizationRequest(input.provider, client, parsed)
  const requestId = await createOAuthAuthorizationRequestSession(
    request,
    input.browserSessionId,
    input.provider.lifetimes.authorizationRequest,
  )
  return { requestId }
}

/**
 * Complete one authenticated, CSRF-verified consent form submission.
 *
 * Identity and workspace values are server-derived inputs. The browser body
 * contributes only the opaque request handle and approve or deny decision.
 */
export async function handleOAuthAuthorizationConsentRequest(
  input: HandleOAuthAuthorizationConsentRequestInput,
): Promise<Response> {
  if (input.request.method !== 'POST')
    return localAuthorizationError(405)
  if (input.request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/x-www-form-urlencoded')
    return localAuthorizationError(415)
  const contentLength = Number(input.request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > 4096)
    return localAuthorizationError(400)

  let consent
  try {
    consent = parseOAuthAuthorizationConsentRequest(await input.request.text())
  }
  catch (error) {
    if (error instanceof OAuthAuthorizationConsentRequestError)
      return localAuthorizationError(400)
    throw error
  }

  if (consent.decision === 'deny') {
    const denied = await denyOAuthAuthorizationRequestSession(consent.requestId, input.browserSessionId)
    return denied.ok ? oauthAuthorizationConsentResponse(denied.value) : localAuthorizationError(400)
  }

  const approved = await approveOAuthAuthorizationRequestSession({
    requestId: consent.requestId,
    browserSessionId: input.browserSessionId,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    workspaceId: input.workspaceId,
    authorizationCodeLifetimeMs: input.provider.lifetimes.authorizationCode,
  })
  return approved.ok ? oauthAuthorizationConsentResponse(approved.value) : localAuthorizationError(400)
}
