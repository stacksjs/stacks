import type { AccessToken } from '@stacksjs/types'
import { findToken } from './tokens'

export interface OAuthDelegatedSubject {
  type: string
  id: number
  clientId: number
  grantId: string
  workspaceId: string | null
}

export interface OAuthDelegatedAccessRequirement {
  scopes: readonly string[]
  resource: string
  audience: string
  workspaceId: string | null
  isSubjectEligible: (subject: OAuthDelegatedSubject) => boolean | Promise<boolean>
}

export type OAuthDelegatedAccessResult
  = { ok: true, token: AccessToken }
    | { ok: false, reason: 'invalid_token' }
    | { ok: false, reason: 'insufficient_scope', requiredScopes: string[] }

type OAuthDelegatedAccessFailure = Exclude<OAuthDelegatedAccessResult, { ok: true }>

const POLICY_TOKEN = /^[\x21\x23-\x5B\x5D-\x7E]+$/

function validateRequirement(requirement: OAuthDelegatedAccessRequirement): void {
  if (!requirement.scopes.length
    || requirement.scopes.some(scope => !POLICY_TOKEN.test(scope))
    || new Set(requirement.scopes).size !== requirement.scopes.length)
    throw new TypeError('OAuth delegated access requires unique non-empty scope tokens.')
  if (!POLICY_TOKEN.test(requirement.resource))
    throw new TypeError('OAuth delegated access resource is invalid.')
  try {
    const audience = new URL(requirement.audience)
    if (audience.username || audience.password || audience.hash)
      throw new TypeError('invalid audience')
  }
  catch {
    throw new TypeError('OAuth delegated access audience must be an absolute URI without credentials or a fragment.')
  }
  if (requirement.workspaceId != null && (!requirement.workspaceId || requirement.workspaceId.length > 255))
    throw new TypeError('OAuth delegated access workspace identifier must be 1 to 255 characters.')
}

/** Resolve and authorize a delegated bearer without promoting it to a user session. */
export async function authorizeOAuthDelegatedToken(
  bearer: string,
  requirement: OAuthDelegatedAccessRequirement,
): Promise<OAuthDelegatedAccessResult> {
  validateRequirement(requirement)
  const token = await findToken(bearer)
  const subjectType = token?.subjectType
  const subjectId = token?.subjectId
  const grantId = token?.grantId
  if (!token || !subjectType || !Number.isSafeInteger(subjectId) || !grantId
    || !token.resources?.includes(requirement.resource)
    || !token.audiences?.includes(requirement.audience)
    || (token.workspaceId ?? null) !== requirement.workspaceId)
    return { ok: false, reason: 'invalid_token' }

  const eligible = await requirement.isSubjectEligible({
    type: subjectType,
    id: subjectId!,
    clientId: token.clientId,
    grantId,
    workspaceId: token.workspaceId ?? null,
  })
  if (!eligible)
    return { ok: false, reason: 'invalid_token' }
  if (!requirement.scopes.every(scope => token.scopes.includes(scope)))
    return { ok: false, reason: 'insufficient_scope', requiredScopes: [...requirement.scopes] }
  return { ok: true, token }
}

/** Format an RFC 6750 challenge for a rejected delegated bearer. */
export function oauthBearerAuthorizationErrorResponse(failure: OAuthDelegatedAccessFailure): Response {
  const insufficient = failure.reason === 'insufficient_scope'
  const scope = insufficient ? `, scope="${failure.requiredScopes.join(' ')}"` : ''
  return new Response(JSON.stringify({ error: failure.reason }), {
    status: insufficient ? 403 : 401,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'WWW-Authenticate': `Bearer error="${failure.reason}"${scope}`,
    },
  })
}
