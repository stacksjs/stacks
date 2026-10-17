import type { ResolvedOAuthProviderConfig } from './oauth-provider'
import type { OAuthAuthorizationPageSubject } from './oauth-authorization-endpoint'
import { readJsonBody, readTextBody, RequestBodyError } from '@stacksjs/router/body'
import { OAuthAuthorizationRequestError } from './oauth-authorization'
import { beginOAuthAuthorizationRequest, handleOAuthAuthorizationConsentRequest } from './oauth-authorization-endpoint'
import { bindOAuthAuthorizationRequestWorkspace } from './oauth-authorization-requests'
import { oauthAuthorizationRequestErrorResponse } from './oauth-authorization-response'
import { oauthAuthorizationBrowserSession } from './oauth-browser-session'
import { loadOAuthAuthorizationConsentView } from './oauth-consent'
import { handleDynamicOAuthRegistration } from './oauth-dynamic-registration'
import { disconnectOAuthGrant, listOAuthConnections } from './oauth-grants'
import { oauthAuthorizationServerMetadata } from './oauth-metadata'
import { handleOAuthRevocationRequest } from './oauth-revocation'
import { handleOAuthTokenRequest } from './oauth-token-endpoint'

export interface OAuthAuthorizationServerOptions {
  provider: ResolvedOAuthProviderConfig | (() => ResolvedOAuthProviderConfig)
  /** Local application page receiving only the browser-bound opaque request id. */
  consentPage: string
  /** Ordinary application login, including 2FA. Never derive authority from the body. */
  authenticate: (request: Request) => Promise<(OAuthAuthorizationPageSubject & { label: string }) | Response | null>
  /** Limit the application connection manager to this exact protected audience. */
  connectionAudience?: string
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: {
    'Cache-Control': 'no-store', 'Pragma': 'no-cache', 'Referrer-Policy': 'no-referrer',
  } })
}
const invalid = () => json({ error: 'invalid_request' }, 400)

/**
 * Framework-owned OAuth HTTP boundaries for a custom application consent UI.
 * Mount raw-body protocol handlers with parseBody(false) and protocol CSRF exemptions.
 * Consent and connection handlers require ordinary login and router CSRF protection.
 * The application supplies its domain eligibility policy and authenticated subject.
 */
export function createOAuthAuthorizationServer(options: OAuthAuthorizationServerOptions) {
  if (!/^\/(?!\/)[^?#\\]*$/.test(options.consentPage) || /[\u0000-\u0020]/.test(options.consentPage))
    throw new TypeError('OAuth consentPage must be a local absolute path.')
  const provider = () => typeof options.provider === 'function' ? options.provider() : options.provider
  const identity = async (request: Request) => {
    const subject = await options.authenticate(request)
    if (subject instanceof Response) return subject
    if (!subject || !/^[A-Za-z0-9_.:-]{1,255}$/.test(subject.type) || !Number.isSafeInteger(subject.id) || subject.id <= 0 || !subject.label.trim())
      return json({ error: 'authentication_required' }, 401)
    return subject
  }
  const method = (request: Request, expected: string) => request.method !== expected
    ? new Response(null, { status: 405, headers: { Allow: expected, 'Cache-Control': 'no-store' } }) : null
  const wire = async (request: Request, handler: (body: string) => Promise<Response>) => {
    const denied = method(request, 'POST')
    if (denied) return denied
    try { return await handler(await readTextBody(request, 16_384)) }
    catch (error) {
      if (error instanceof RequestBodyError) return json({ error: 'invalid_request' }, error.status)
      throw error
    }
  }
  return {
    metadata: () => json(oauthAuthorizationServerMetadata(provider())),
    async register(request: Request): Promise<Response> {
      const denied = method(request, 'POST')
      if (denied) return denied
      try { return await handleDynamicOAuthRegistration(provider(), await readJsonBody(request, 16_384)) }
      catch (error) {
        if (error instanceof RequestBodyError) return json({ error: 'invalid_client_metadata' }, error.status)
        throw error
      }
    },
    async begin(request: Request): Promise<Response> {
      const denied = method(request, 'GET')
      if (denied) return denied
      const resolved = provider()
      const browser = oauthAuthorizationBrowserSession(request, resolved)
      try {
        const result = await beginOAuthAuthorizationRequest({ provider: resolved, query: new URL(request.url).searchParams, browserSessionId: browser.id })
        return new Response(null, { status: 302, headers: { Location: `${options.consentPage}?request_id=${encodeURIComponent(result.requestId)}`, 'Set-Cookie': browser.cookie, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
      }
      catch (error) {
        if (!(error instanceof OAuthAuthorizationRequestError)) throw error
        return oauthAuthorizationRequestErrorResponse(error, resolved.issuer) ?? invalid()
      }
    },
    async consent(request: Request): Promise<Response> {
      if (!['GET', 'POST'].includes(request.method)) return method(request, 'GET, POST')!
      const subject = await identity(request)
      if (subject instanceof Response) return subject
      const resolved = provider()
      if (request.method === 'POST') return handleOAuthAuthorizationConsentRequest({ provider: resolved, request, subjectType: subject.type, subjectId: subject.id, workspaceId: subject.workspaceId, resolveWorkspaceId: subject.resolveWorkspaceId })
      const params = new URL(request.url).searchParams
      if (params.getAll('request_id').length !== 1 || [...params.keys()].some(key => key !== 'request_id')) return invalid()
      if (resolved.consent.resolveWorkspace && !await bindOAuthAuthorizationRequestWorkspace(params.get('request_id')!, oauthAuthorizationBrowserSession(request, resolved).id, subject.workspaceId ?? null)) return invalid()
      const consent = await loadOAuthAuthorizationConsentView({ provider: resolved, requestId: params.get('request_id')!, browserSessionId: oauthAuthorizationBrowserSession(request, resolved).id })
      if (!consent) return invalid()
      return json({ consent, user: { id: subject.id, name: subject.label } })
    },
    token: (request: Request) => wire(request, body => {
      const resolved = provider()
      return handleOAuthTokenRequest(resolved, { body, contentType: request.headers.get('content-type'), authorization: request.headers.get('authorization') }, { isSubjectEligible: resolved.subjectEligibility ?? (() => false) })
    }),
    revoke: (request: Request) => wire(request, body => handleOAuthRevocationRequest({ body, contentType: request.headers.get('content-type'), authorization: request.headers.get('authorization') })),
    async connections(request: Request): Promise<Response> {
      const denied = method(request, 'GET')
      if (denied) return denied
      const subject = await identity(request)
      if (subject instanceof Response) return subject
      const connections = (await listOAuthConnections(subject.type, subject.id)).filter(connection => !options.connectionAudience || connection.audiences.includes(options.connectionAudience))
      return json({ connections })
    },
    async disconnect(request: Request, grantId: string): Promise<Response> {
      const denied = method(request, 'DELETE')
      if (denied) return denied
      const subject = await identity(request)
      if (subject instanceof Response) return subject
      const connections = await listOAuthConnections(subject.type, subject.id)
      if (!connections.some(connection => connection.grantId === grantId && (!options.connectionAudience || connection.audiences.includes(options.connectionAudience))))
        return json({ disconnected: false })
      return json({ disconnected: await disconnectOAuthGrant(subject.type, subject.id, grantId) })
    },
  }
}
