import * as oauth from 'oauth4webapi'

/** Operator-approved OIDC relying-party configuration. Never derive this from login input. */
export interface EnterpriseOidcConfig {
  issuer: string
  clientId: string
  clientSecret: string
  redirectUri: string
  /** Exact HTTPS endpoint URLs approved by the operator for this client. */
  approvedEndpoints?: {
    authorizationEndpoint?: string
    tokenEndpoint?: string
    jwksUri?: string
  }
  /** An injected provider HTTP boundary for tests or a controlled egress transport. */
  fetch?: typeof fetch
}
export interface EnterpriseOidcChallenge { state: string, nonce: string, verifier: string }
export interface EnterpriseOidcIdentity { issuer: string, subject: string, email: string | null, emailVerified: boolean }

function https(value: string): URL {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.hash)
    throw new TypeError('Enterprise OIDC requires HTTPS URLs without credentials or fragments.')
  return url
}
function options(config: EnterpriseOidcConfig) {
  const transport = config.fetch ?? fetch
  return { [oauth.customFetch]: async (url: string, init: RequestInit) => {
    const response = await transport(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(10_000) })
    if (response.status >= 300 && response.status < 400) throw new TypeError('OIDC endpoint redirects are not allowed.')
    return response
  } }
}

function verifyEndpoint(endpoint: string | undefined, approved: string | undefined, issuerOrigin: string) {
  if (!endpoint) throw new TypeError('OIDC discovery is missing a required endpoint.')
  const url = https(endpoint)
  if (approved !== undefined) {
    if (endpoint !== approved) throw new TypeError('OIDC discovery does not match the approved endpoint.')
  }
  else if (url.origin !== issuerOrigin) {
    throw new TypeError('OIDC endpoints must use the approved issuer origin.')
  }
}

async function provider(config: EnterpriseOidcConfig) {
  const issuer = https(config.issuer)
  https(config.redirectUri)
  if (!config.clientId || !config.clientSecret) throw new TypeError('OIDC client configuration is missing.')
  const requestOptions = options(config)
  const metadata = await oauth.processDiscoveryResponse(issuer, await oauth.discoveryRequest(issuer, { ...requestOptions, algorithm: 'oidc' }))
  const approved = config.approvedEndpoints
  verifyEndpoint(metadata.authorization_endpoint, approved?.authorizationEndpoint, issuer.origin)
  verifyEndpoint(metadata.token_endpoint, approved?.tokenEndpoint, issuer.origin)
  verifyEndpoint(metadata.jwks_uri, approved?.jwksUri, issuer.origin)
  const client: oauth.Client = { client_id: config.clientId, id_token_signed_response_alg: 'RS256' }
  return { metadata, client, requestOptions }
}

/** Store all three fields in a one-use, browser-bound native OAuth flow. */
export function enterpriseOidcChallenge(): EnterpriseOidcChallenge {
  return { state: oauth.generateRandomState(), nonce: oauth.generateRandomNonce(), verifier: oauth.generateRandomCodeVerifier() }
}

export async function enterpriseOidcAuthorization(config: EnterpriseOidcConfig, challenge: EnterpriseOidcChallenge): Promise<string> {
  const { metadata } = await provider(config)
  const url = new URL(metadata.authorization_endpoint!)
  url.search = new URLSearchParams({
    client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code', scope: 'openid email',
    state: challenge.state, nonce: challenge.nonce,
    code_challenge: await oauth.calculatePKCECodeChallenge(challenge.verifier), code_challenge_method: 'S256',
  }).toString()
  return url.href
}

/**
 * The caller must consume a native browser-bound OAuth flow before this call.
 * Signature validation is mandatory even though HTTPS protects token transport.
 * Returns identity only. Account linking and role assignment remain application policy.
 */
export async function verifyEnterpriseOidcCallback(config: EnterpriseOidcConfig, callbackUrl: string, challenge: EnterpriseOidcChallenge): Promise<EnterpriseOidcIdentity> {
  const callback = new URL(callbackUrl)
  const expected = new URL(config.redirectUri)
  if (callback.origin !== expected.origin || callback.pathname !== expected.pathname)
    throw new TypeError('OIDC callback does not match the registered redirect URI.')
  const { metadata, client, requestOptions } = await provider(config)
  const params = oauth.validateAuthResponse(metadata, client, callback, challenge.state)
  const response = await oauth.authorizationCodeGrantRequest(metadata, client, oauth.ClientSecretPost(config.clientSecret), params, config.redirectUri, challenge.verifier, requestOptions)
  const result = await oauth.processAuthorizationCodeResponse(metadata, client, response, { requireIdToken: true, expectedNonce: challenge.nonce })
  await oauth.validateApplicationLevelSignature(metadata, response, requestOptions)
  const claims = oauth.getValidatedIdTokenClaims(result)
  if (!claims?.sub || claims.iss !== config.issuer) throw new TypeError('OIDC identity is missing.')
  return { issuer: claims.iss, subject: claims.sub, email: typeof claims.email === 'string' ? claims.email : null, emailVerified: claims.email_verified === true }
}
