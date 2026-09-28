import type { ResolvedOAuthProviderConfig } from './oauth-provider'
import { isValidS256CodeChallenge } from './oauth-pkce'

export type OAuthAuthorizationRequestErrorCode
  = | 'invalid_request'
    | 'unauthorized_client'
    | 'unsupported_response_type'
    | 'invalid_scope'
    | 'invalid_target'

export interface OAuthAuthorizationClientRegistration {
  id: string | number
  type: 'confidential' | 'public'
  revoked: boolean
  redirectUris: readonly string[]
  grantTypes: readonly string[]
  scopes: readonly string[]
  resources: readonly string[]
}

export interface OAuthAuthorizationRequestInput {
  responseType: string
  clientId: string
  redirectUri: string
  scope?: string
  resource?: string | readonly string[]
  state?: string
  codeChallenge?: string
  codeChallengeMethod?: string
}

export interface ValidatedOAuthAuthorizationRequest {
  responseType: 'code'
  clientId: string
  clientType: 'confidential' | 'public'
  redirectUri: string
  scopes: string[]
  /** Provider resource keys used by internal policy checks. */
  resources: string[]
  /** Exact RFC 8707 resource indicator values bound to issued tokens. */
  audiences: string[]
  state: string | null
  codeChallenge: string
  codeChallengeMethod: 'S256'
}

/** A protocol failure plus the only callback target that is safe to use. */
export class OAuthAuthorizationRequestError extends Error {
  constructor(
    public readonly code: OAuthAuthorizationRequestErrorCode,
    message: string,
    public readonly redirectUri: string | null = null,
    public readonly state: string | null = null,
  ) {
    super(message)
    this.name = 'OAuthAuthorizationRequestError'
  }
}

function reject(
  code: OAuthAuthorizationRequestErrorCode,
  message: string,
  redirectUri: string | null = null,
  state: string | null = null,
): never {
  throw new OAuthAuthorizationRequestError(code, message, redirectUri, state)
}

function scalarParameter(params: URLSearchParams, name: string, required = false): string | undefined {
  const values = params.getAll(name)
  if (values.length > 1)
    reject('invalid_request', `OAuth authorization parameter must not be repeated: ${name}`)
  if (required && (!values.length || values[0] === ''))
    reject('invalid_request', `OAuth authorization parameter is required: ${name}`)
  return values[0]
}

/** Parse the browser query without trusting any callback URL it contains. */
export function parseOAuthAuthorizationRequest(
  query: string | URLSearchParams,
): OAuthAuthorizationRequestInput {
  const encoded = typeof query === 'string' ? query.replace(/^\?/, '') : query.toString()
  if (encoded.length > 8192)
    reject('invalid_request', 'OAuth authorization request is too large.')

  const params = typeof query === 'string' ? new URLSearchParams(encoded) : query
  const responseType = scalarParameter(params, 'response_type', true)!
  const clientId = scalarParameter(params, 'client_id', true)!
  const redirectUri = scalarParameter(params, 'redirect_uri', true)!
  const scope = scalarParameter(params, 'scope')
  const state = scalarParameter(params, 'state')
  const codeChallenge = scalarParameter(params, 'code_challenge', true)!
  const codeChallengeMethod = scalarParameter(params, 'code_challenge_method', true)!
  const resources = params.getAll('resource')

  return {
    responseType,
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    ...(scope === undefined ? {} : { scope }),
    ...(resources.length ? { resource: resources } : {}),
    ...(state === undefined ? {} : { state }),
  }
}

/** Whether a registered callback is safe for exact redirect matching. */
export function isValidOAuthRedirectUri(value: string): boolean {
  if (value.includes('*'))
    return false

  let url: URL
  try {
    url = new URL(value)
  }
  catch {
    return false
  }

  if (url.username || url.password || url.hash)
    return false

  const loopback = url.hostname === 'localhost'
    || url.hostname === '127.0.0.1'
    || url.hostname === '[::1]'
  return url.protocol === 'https:' || (url.protocol === 'http:' && loopback)
}

function requestedScopes(
  value: string | undefined,
  redirectUri: string,
  state: string | null,
): string[] {
  if (value == null || value === '')
    return []

  const scopes = value.split(' ')
  if (scopes.some(scope => !scope || !/^[\x21\x23-\x5B\x5D-\x7E]+$/.test(scope)))
    reject('invalid_scope', 'OAuth scopes must be space-separated visible ASCII tokens.', redirectUri, state)

  return [...new Set(scopes)]
}

function requestedAudiences(
  value: string | readonly string[] | undefined,
  redirectUri: string,
  state: string | null,
): string[] {
  if (value == null)
    return []
  const resources = typeof value === 'string' ? [value] : [...value]
  if (resources.some(resource => !resource))
    reject('invalid_target', 'OAuth resources must not be empty.', redirectUri, state)
  return [...new Set(resources)]
}

/**
 * Validate the complete, browser-facing authorization request boundary.
 *
 * The caller loads the client from authoritative storage. This function then
 * refuses to expose a redirect target until that client is active and the URI
 * is an exact, secure registration match. Routes can therefore return local
 * errors for forged client or redirect input without creating an open redirect.
 */
export function validateOAuthAuthorizationRequest(
  provider: ResolvedOAuthProviderConfig,
  client: OAuthAuthorizationClientRegistration,
  input: OAuthAuthorizationRequestInput,
): ValidatedOAuthAuthorizationRequest {
  if (String(client.id) !== input.clientId)
    reject('invalid_request', 'OAuth client identifier does not match the loaded client.')
  if (client.revoked)
    reject('unauthorized_client', 'OAuth client is disabled.')
  if (!provider.clientTypes.includes(client.type))
    reject('unauthorized_client', 'OAuth client type is not enabled by this provider.')
  if (!client.redirectUris.includes(input.redirectUri) || !isValidOAuthRedirectUri(input.redirectUri))
    reject('invalid_request', 'OAuth redirect URI is not an exact secure registration match.')

  const state = typeof input.state === 'string' ? input.state : null
  const redirectUri = input.redirectUri

  if (input.responseType !== 'code')
    reject('unsupported_response_type', 'Only response_type=code is supported.', redirectUri, state)
  if (!client.grantTypes.includes('authorization_code'))
    reject('unauthorized_client', 'OAuth client may not use the authorization code grant.', redirectUri, state)
  if (input.codeChallengeMethod !== 'S256')
    reject('invalid_request', 'OAuth authorization requests require code_challenge_method=S256.', redirectUri, state)
  if (!isValidS256CodeChallenge(input.codeChallenge))
    reject('invalid_request', 'OAuth authorization request has an invalid S256 code challenge.', redirectUri, state)

  const scopes = requestedScopes(input.scope, redirectUri, state)
  for (const scope of scopes) {
    if (!provider.scopes[scope] || !client.scopes.includes(scope))
      reject('invalid_scope', `OAuth scope is not registered for this client: ${scope}`, redirectUri, state)
  }

  const audiences = requestedAudiences(input.resource, redirectUri, state)
  const resources: string[] = []
  for (const audience of audiences) {
    const matchingResources = Object.entries(provider.resources)
      .filter(([, resource]) => resource.audience === audience)
      .map(([key]) => key)
    if (matchingResources.length !== 1 || !client.resources.includes(matchingResources[0]!))
      reject('invalid_target', `OAuth resource is not registered for this client: ${audience}`, redirectUri, state)
    resources.push(matchingResources[0]!)
  }

  for (const scope of scopes) {
    const allowedResources = provider.scopes[scope]?.resources
    if (!allowedResources?.length)
      continue
    if (!resources.length || resources.some(resource => !allowedResources.includes(resource)))
      reject('invalid_target', `OAuth scope is not valid for the requested resource: ${scope}`, redirectUri, state)
  }

  return {
    responseType: 'code',
    clientId: input.clientId,
    clientType: client.type,
    redirectUri,
    scopes,
    resources,
    audiences,
    state,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: 'S256',
  }
}
