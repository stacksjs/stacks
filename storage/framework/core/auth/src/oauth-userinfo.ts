import type { OAuthDelegatedAccessRequirement, OAuthDelegatedAccessResult, OAuthDelegatedSubject } from './oauth-delegated-access'
import { createHmac } from 'node:crypto'
import { authorizeOAuthDelegatedToken, oauthBearerAuthorizationErrorResponse } from './oauth-delegated-access'

/**
 * A subject identifier unique to one client: the same person reads as a
 * different `sub` to every relying party, so two clients that compare notes
 * cannot join their records on it (OpenID Connect Core §8.1, pairwise).
 * Stable for a client as long as `secret` is; rotating the secret re-keys
 * every relying party, so keep it apart from rotating application keys.
 */
export function pairwiseOAuthSubject(secret: string, clientId: string | number, subject: Pick<OAuthDelegatedSubject, 'type' | 'id'>): string {
  if (secret.length < 32)
    throw new TypeError('A pairwise subject secret must be at least 32 characters.')
  if (clientId === '' || clientId == null || !subject.type || !Number.isSafeInteger(subject.id))
    throw new TypeError('A pairwise subject needs a client, a subject type and a numeric subject id.')
  return createHmac('sha256', secret).update(`${clientId}\u0000${subject.type}\u0000${subject.id}`).digest('base64url')
}

export interface OAuthUserInfoContext {
  /** The pairwise subject this client knows the person as. */
  sub: string
  subject: OAuthDelegatedSubject
  clientId: number
  /** Every scope the token carries, the required ones included. */
  scopes: readonly string[]
}

export interface OAuthUserInfoOptions extends OAuthDelegatedAccessRequirement {
  /** Keys the pairwise `sub`; see {@link pairwiseOAuthSubject}. */
  pairwiseSecret: string
  /**
   * Claims for the granted scopes. Release only what `scopes` covers; `sub`
   * is added afterwards and cannot be overridden. Null answers 401, for a
   * subject that no longer exists.
   */
  claims: (context: OAuthUserInfoContext) => Promise<Record<string, unknown> | null>
  /** Test seam; defaults to {@link authorizeOAuthDelegatedToken}. */
  authorize?: (bearer: string, requirement: OAuthDelegatedAccessRequirement) => Promise<OAuthDelegatedAccessResult>
}

function bearerOf(request: Request): string | null {
  const header = request.headers.get('authorization') || ''
  const match = /^Bearer ([\x21-\x7E]{1,4096})$/.exec(header)
  return match ? match[1]! : null
}

/**
 * A userinfo endpoint for this provider's delegated tokens: the same
 * resource, audience and eligibility checks as any protected resource, then
 * a pairwise `sub` plus the claims the granted scopes allow. The provider has
 * no id_token, so a relying party signs a person in with this answer.
 */
export async function oauthUserInfoResponse(request: Request, options: OAuthUserInfoOptions): Promise<Response> {
  const bearer = bearerOf(request)
  if (!bearer)
    return oauthBearerAuthorizationErrorResponse({ ok: false, reason: 'invalid_token' })
  const { pairwiseSecret, claims, authorize = authorizeOAuthDelegatedToken, ...requirement } = options
  let subject: OAuthDelegatedSubject | null = null
  const result = await authorize(bearer, {
    ...requirement,
    isSubjectEligible: async (candidate) => {
      subject = candidate
      return requirement.isSubjectEligible(candidate)
    },
  })
  if (!result.ok)
    return oauthBearerAuthorizationErrorResponse(result)
  const resolved = subject as OAuthDelegatedSubject | null
  if (!resolved)
    return oauthBearerAuthorizationErrorResponse({ ok: false, reason: 'invalid_token' })
  const sub = pairwiseOAuthSubject(pairwiseSecret, resolved.clientId, resolved)
  const released = await claims({ sub, subject: resolved, clientId: resolved.clientId, scopes: [...result.token.scopes] })
  if (!released)
    return oauthBearerAuthorizationErrorResponse({ ok: false, reason: 'invalid_token' })
  return new Response(JSON.stringify({ ...released, sub }), {
    headers: { 'Cache-Control': 'no-store', 'Pragma': 'no-cache', 'Content-Type': 'application/json; charset=utf-8' },
  })
}
