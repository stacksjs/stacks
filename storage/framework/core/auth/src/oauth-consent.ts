import type { OAuthAuthorizationRequestSessionResult } from './oauth-authorization-requests'
import { issueAuthorizationCode } from './oauth-authorization-codes'
import { withOAuthAuthorizationRequestSession } from './oauth-authorization-requests'
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
