import type { ResolvedOAuthProviderConfig } from './oauth-provider'
import {
  exchangeOAuthAuthorizationCode,
  refreshOAuthDelegatedToken,
} from './oauth-token-exchange'
import {
  OAuthTokenRequestError,
  parseOAuthTokenRequest,
} from './oauth-token-request'
import {
  oauthTokenErrorResponse,
  oauthTokenExchangeResponse,
} from './oauth-token-response'

export interface OAuthTokenEndpointRequest {
  body: string
  contentType?: string | null
  authorization?: string | null
}

/** Execute one token request against the resolved provider without registering a route. */
export async function handleOAuthTokenRequest(
  provider: ResolvedOAuthProviderConfig,
  input: OAuthTokenEndpointRequest,
): Promise<Response> {
  const basic = /^Basic\s/i.test(input.authorization ?? '')
  const responseOptions = { clientAuthenticatedWithBasic: basic }
  const mediaType = input.contentType?.split(';', 1)[0]?.trim().toLowerCase()
  if (mediaType !== 'application/x-www-form-urlencoded')
    return oauthTokenErrorResponse('invalid_request', responseOptions)

  try {
    const request = parseOAuthTokenRequest(input.body, input.authorization)
    if (request.grantType === 'authorization_code') {
      const result = await exchangeOAuthAuthorizationCode({
        code: request.code,
        clientId: request.clientId,
        clientSecret: request.clientSecret,
        redirectUri: request.redirectUri,
        codeVerifier: request.codeVerifier,
        accessTokenLifetimeMs: provider.lifetimes.accessToken,
        refreshTokenLifetimeMs: provider.lifetimes.refreshToken,
      })
      return oauthTokenExchangeResponse(result, responseOptions)
    }

    const result = await refreshOAuthDelegatedToken({
      refreshToken: request.refreshToken,
      clientId: request.clientId,
      clientSecret: request.clientSecret,
      scopes: request.scopes,
      accessTokenLifetimeMs: provider.lifetimes.accessToken,
      refreshTokenLifetimeMs: provider.lifetimes.refreshToken,
    })
    return oauthTokenExchangeResponse(result, responseOptions)
  }
  catch (error) {
    if (error instanceof OAuthTokenRequestError)
      return oauthTokenErrorResponse(error.error, responseOptions)
    throw error
  }
}
