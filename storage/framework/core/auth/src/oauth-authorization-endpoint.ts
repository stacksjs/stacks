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
  loadOAuthAuthorizationConsentView,
  OAuthAuthorizationConsentRequestError,
  parseOAuthAuthorizationConsentRequest,
} from './oauth-consent'
import type { OAuthAuthorizationConsentView } from './oauth-consent'
import { isOAuthAuthorizationRequestId } from './oauth-authorization-requests'
import { oauthAuthorizationBrowserSession } from './oauth-browser-session'
import {
  oauthAuthorizationConsentResponse,
  oauthAuthorizationRequestErrorResponse,
} from './oauth-authorization-response'

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
  subjectType: string
  subjectId: number
  workspaceId?: string | null
}

export interface OAuthAuthorizationPageIdentity {
  /** Display-only signed-in identity, such as a name or email address. */
  label: string
  /** Display-only workspace name. Authority stays in server-side state. */
  workspaceLabel?: string | null
}

export interface OAuthAuthorizationConsentPageContext {
  consent: OAuthAuthorizationConsentView
  signedInIdentity: string
  selectedWorkspace: string | null
  consentAction: string
  csrfToken: string
}

export interface OAuthAuthorizationPageDependencies {
  begin?: typeof beginOAuthAuthorizationRequest
  loadConsent?: typeof loadOAuthAuthorizationConsentView
  render: (view: string, context: OAuthAuthorizationConsentPageContext) => Promise<string>
}

export interface HandleOAuthAuthorizationPageRequestInput {
  provider: ResolvedOAuthProviderConfig
  request: Request
  /** Null until ordinary login and any required 2FA have completed. */
  identity: OAuthAuthorizationPageIdentity | null
  /** Router-seeded CSRF proof, required only when rendering the form. */
  csrfToken?: string
  dependencies: OAuthAuthorizationPageDependencies
}

const LOCAL_ERROR_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'Pragma': 'no-cache',
  'Referrer-Policy': 'no-referrer',
} as const

const PAGE_SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "frame-ancestors 'none'",
  'Pragma': 'no-cache',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
} as const

function localAuthorizationError(status: number): Response {
  return new Response(JSON.stringify({ error: 'invalid_request' }), {
    status,
    headers: LOCAL_ERROR_HEADERS,
  })
}

function pageResponse(body: BodyInit | null, status: number, cookie: string, headers?: HeadersInit): Response {
  return new Response(body, {
    status,
    headers: {
      ...PAGE_SECURITY_HEADERS,
      'Set-Cookie': cookie,
      ...headers,
    },
  })
}

function resumedAuthorizationRequestId(params: URLSearchParams): string | null | undefined {
  const values = params.getAll('request_id')
  if (!values.length)
    return undefined
  if (values.length !== 1 || [...params.keys()].some(name => name !== 'request_id'))
    return null
  return isOAuthAuthorizationRequestId(values[0]!) ? values[0]! : null
}

/**
 * Start or resume the browser authorization page without registering a route.
 *
 * Login receives only a local resume URL carrying the opaque request handle.
 * Callback, PKCE, client state, subject, and workspace authority remain in the
 * database record bound to the HttpOnly browser-session cookie.
 */
export async function handleOAuthAuthorizationPageRequest(
  input: HandleOAuthAuthorizationPageRequestInput,
): Promise<Response> {
  if (input.request.method !== 'GET')
    return localAuthorizationError(405)

  const browser = oauthAuthorizationBrowserSession(input.request, input.provider)
  const url = new URL(input.request.url)
  const resumed = resumedAuthorizationRequestId(url.searchParams)
  if (resumed === null)
    return pageResponse(JSON.stringify({ error: 'invalid_request' }), 400, browser.cookie, { 'Content-Type': 'application/json; charset=utf-8' })

  let requestId = resumed
  if (requestId === undefined) {
    try {
      const begin = input.dependencies.begin ?? beginOAuthAuthorizationRequest
      requestId = (await begin({
        provider: input.provider,
        query: url.searchParams,
        browserSessionId: browser.id,
      })).requestId
    }
    catch (error) {
      if (!(error instanceof OAuthAuthorizationRequestError))
        throw error
      const protocol = oauthAuthorizationRequestErrorResponse(error)
      if (!protocol)
        return pageResponse(JSON.stringify({ error: 'invalid_request' }), 400, browser.cookie, { 'Content-Type': 'application/json; charset=utf-8' })
      const headers = new Headers(protocol.headers)
      headers.set('Set-Cookie', browser.cookie)
      return new Response(protocol.body, { status: protocol.status, headers })
    }
  }

  const loadConsent = input.dependencies.loadConsent ?? loadOAuthAuthorizationConsentView
  const consent = await loadConsent({
    provider: input.provider,
    requestId,
    browserSessionId: browser.id,
  })
  if (!consent)
    return pageResponse(JSON.stringify({ error: 'invalid_request' }), 400, browser.cookie, { 'Content-Type': 'application/json; charset=utf-8' })

  if (!input.identity) {
    const authorization = new URL(input.provider.endpoints.authorization)
    const resume = `${authorization.pathname}?request_id=${encodeURIComponent(requestId)}`
    return pageResponse(null, 302, browser.cookie, {
      Location: `/login?redirect=${encodeURIComponent(resume)}`,
    })
  }

  if (!input.identity.label.trim() || !input.csrfToken)
    return pageResponse(JSON.stringify({ error: 'server_error' }), 500, browser.cookie, { 'Content-Type': 'application/json; charset=utf-8' })

  const html = await input.dependencies.render(input.provider.consent.view, {
    consent,
    signedInIdentity: input.identity.label,
    selectedWorkspace: input.identity.workspaceLabel ?? null,
    consentAction: input.provider.endpoints.authorization,
    csrfToken: input.csrfToken,
  })
  return pageResponse(html, 200, browser.cookie, { 'Content-Type': 'text/html; charset=utf-8' })
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

  const browserSessionId = oauthAuthorizationBrowserSession(input.request, input.provider).id

  if (consent.decision === 'deny') {
    const denied = await denyOAuthAuthorizationRequestSession(consent.requestId, browserSessionId)
    return denied.ok ? oauthAuthorizationConsentResponse(denied.value) : localAuthorizationError(400)
  }

  let approved
  try {
    approved = await approveOAuthAuthorizationRequestSession({
      provider: input.provider,
      requestId: consent.requestId,
      browserSessionId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      workspaceId: input.workspaceId,
      authorizationCodeLifetimeMs: input.provider.lifetimes.authorizationCode,
    })
  }
  catch (error) {
    if (error instanceof OAuthAuthorizationRequestError)
      return oauthAuthorizationRequestErrorResponse(error) ?? localAuthorizationError(400)
    throw error
  }
  return approved.ok ? oauthAuthorizationConsentResponse(approved.value) : localAuthorizationError(400)
}
