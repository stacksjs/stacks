import type { ResolvedOAuthProviderConfig } from './oauth-provider'
import {
  OAuthAuthorizationRequestError,
  parseOAuthAuthorizationRequest,
  validateOAuthAuthorizationRequest,
} from './oauth-authorization'
import { createOAuthAuthorizationRequestSession } from './oauth-authorization-requests'
import { loadOAuthAuthorizationClient } from './oauth-client-registration'

export interface BeginOAuthAuthorizationRequestInput {
  provider: ResolvedOAuthProviderConfig
  query: string | URLSearchParams
  browserSessionId: string
}

export interface BegunOAuthAuthorizationRequest {
  /** The only value that login and consent forms need to preserve. */
  requestId: string
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
