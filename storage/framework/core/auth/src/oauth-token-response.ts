import type {
  OAuthAuthorizationCodeExchangeResult,
  OAuthRefreshTokenExchangeResult,
} from './oauth-token-exchange'
import type { OAuthTokenRequestErrorCode } from './oauth-token-request'

export type OAuthTokenProtocolErrorCode
  = OAuthTokenRequestErrorCode
    | 'invalid_grant'
    | 'invalid_scope'
    | 'unauthorized_client'

export interface OAuthTokenResponseOptions {
  clientAuthenticatedWithBasic?: boolean
}

const TOKEN_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'Pragma': 'no-cache',
} as const

/** Return one OAuth error without exposing authentication or grant details. */
export function oauthTokenErrorResponse(
  error: OAuthTokenProtocolErrorCode,
  options: OAuthTokenResponseOptions = {},
): Response {
  const challenge = error === 'invalid_client' && options.clientAuthenticatedWithBasic
  return new Response(JSON.stringify({ error }), {
    status: challenge ? 401 : 400,
    headers: {
      ...TOKEN_HEADERS,
      ...(challenge ? { 'WWW-Authenticate': 'Basic realm="oauth-token"' } : {}),
    },
  })
}

/** Serialize only the public OAuth token fields and apply mandatory no-store headers. */
export function oauthTokenExchangeResponse(
  result: OAuthAuthorizationCodeExchangeResult | OAuthRefreshTokenExchangeResult,
  options: OAuthTokenResponseOptions = {},
): Response {
  if (!result.ok)
    return oauthTokenErrorResponse(result.reason, options)

  const token = result.value
  return new Response(JSON.stringify({
    access_token: token.accessToken,
    token_type: token.tokenType,
    expires_in: token.expiresIn,
    ...(token.refreshToken ? { refresh_token: token.refreshToken } : {}),
    scope: token.scopes.join(' '),
  }), {
    status: 200,
    headers: TOKEN_HEADERS,
  })
}
