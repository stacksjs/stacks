import type { ResolvedOAuthProviderConfig } from './oauth-provider'
import { isValidOAuthRedirectUri } from './oauth-authorization'

export type OAuthTokenEndpointAuthMethod = 'client_secret_basic' | 'none'

export interface OAuthClientRegistrationInput {
  name: string
  type: 'confidential' | 'public'
  tokenEndpointAuthMethod: OAuthTokenEndpointAuthMethod
  redirectUris: readonly string[]
  grantTypes: readonly string[]
  scopes: readonly string[]
  resources: readonly string[]
}

export interface ValidatedOAuthClientRegistration extends OAuthClientRegistrationInput {
  name: string
  redirectUris: string[]
  grantTypes: string[]
  scopes: string[]
  resources: string[]
  requiresSecret: boolean
}

export class OAuthClientRegistrationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OAuthClientRegistrationError'
  }
}

function reject(message: string): never {
  throw new OAuthClientRegistrationError(message)
}

function explicitUnique(name: string, values: readonly string[], options: { required?: boolean } = {}): string[] {
  if (options.required && values.length === 0)
    reject(`OAuth client must register at least one ${name}.`)
  if (values.some(value => !value))
    reject(`OAuth client ${name} entries must not be empty.`)
  if (new Set(values).size !== values.length)
    reject(`OAuth client ${name} contains a duplicate entry.`)
  return [...values]
}

/** Validate client-controlled metadata before any secret or database row exists. */
export function validateOAuthClientRegistration(
  provider: ResolvedOAuthProviderConfig,
  input: OAuthClientRegistrationInput,
): ValidatedOAuthClientRegistration {
  const name = input.name.trim()
  if (!name || name.length > 100 || /[\u0000-\u001F\u007F]/.test(name))
    reject('OAuth client name must be 1 to 100 characters without control characters.')

  if (!provider.clientTypes.includes(input.type))
    reject(`OAuth client type is not enabled by this provider: ${input.type}`)
  if (input.type === 'public' && input.tokenEndpointAuthMethod !== 'none')
    reject('Public OAuth clients must use token endpoint authentication method none.')
  if (input.type === 'confidential' && input.tokenEndpointAuthMethod !== 'client_secret_basic')
    reject('Confidential OAuth clients must use token endpoint authentication method client_secret_basic.')

  const redirectUris = explicitUnique('redirect URI', input.redirectUris, { required: true })
  if (redirectUris.some(uri => !isValidOAuthRedirectUri(uri)))
    reject('OAuth client redirect URIs must be exact HTTPS URLs or exact loopback HTTP URLs, without credentials, fragments, or wildcards.')

  const grantTypes = explicitUnique('grant type', input.grantTypes, { required: true })
  if (!grantTypes.includes('authorization_code'))
    reject('OAuth client grant types must include authorization_code.')
  for (const grantType of grantTypes) {
    if (!provider.grantTypes.includes(grantType as 'authorization_code' | 'refresh_token'))
      reject(`OAuth client requested an unsupported grant type: ${grantType}`)
  }

  const scopes = explicitUnique('scope', input.scopes, { required: true })
  for (const scope of scopes) {
    if (!provider.scopes[scope])
      reject(`OAuth client requested an unregistered scope: ${scope}`)
  }

  const resources = explicitUnique('resource', input.resources)
  for (const resource of resources) {
    if (!provider.resources[resource])
      reject(`OAuth client requested an unregistered resource: ${resource}`)
  }

  for (const scope of scopes) {
    const allowedResources = provider.scopes[scope]?.resources
    if (allowedResources?.length && !resources.some(resource => allowedResources.includes(resource)))
      reject(`OAuth client scope requires a registered resource: ${scope}`)
  }

  return {
    name,
    type: input.type,
    tokenEndpointAuthMethod: input.tokenEndpointAuthMethod,
    redirectUris,
    grantTypes,
    scopes,
    resources,
    requiresSecret: input.type === 'confidential',
  }
}
