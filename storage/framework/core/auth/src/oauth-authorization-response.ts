import type {
  OAuthAuthorizationConsentResult,
  OAuthAuthorizationDenialResult,
} from './oauth-consent'
import { isValidOAuthRedirectUri, OAuthAuthorizationRequestError } from './oauth-authorization'

const AUTHORIZATION_REDIRECT_HEADERS = {
  'Cache-Control': 'no-store',
  'Pragma': 'no-cache',
  'Referrer-Policy': 'no-referrer',
} as const

const RESPONSE_PARAMETERS = [
  'code',
  'error',
  'error_description',
  'error_uri',
  'state',
] as const

function redirectResponse(
  redirectUri: string,
  result: { code: string } | { error: string },
  state: string | null,
): Response {
  if (!isValidOAuthRedirectUri(redirectUri))
    throw new TypeError('OAuth authorization response requires a safe redirect URI.')

  const target = new URL(redirectUri)
  for (const parameter of RESPONSE_PARAMETERS)
    target.searchParams.delete(parameter)
  if ('code' in result)
    target.searchParams.set('code', result.code)
  else
    target.searchParams.set('error', result.error)
  if (state !== null)
    target.searchParams.set('state', state)

  return new Response(null, {
    status: 302,
    headers: {
      ...AUTHORIZATION_REDIRECT_HEADERS,
      Location: target.toString(),
    },
  })
}

/** Redirect an approved or denied consent result to its already validated callback. */
export function oauthAuthorizationConsentResponse(
  result: OAuthAuthorizationConsentResult | OAuthAuthorizationDenialResult,
): Response {
  return 'code' in result
    ? redirectResponse(result.redirectUri, { code: result.code }, result.state)
    : redirectResponse(result.redirectUri, { error: result.error }, result.state)
}

/** Redirect a protocol failure only when validation produced a trusted callback. */
export function oauthAuthorizationRequestErrorResponse(
  error: OAuthAuthorizationRequestError,
): Response | null {
  if (error.redirectUri === null)
    return null
  return redirectResponse(error.redirectUri, { error: error.code }, error.state)
}
