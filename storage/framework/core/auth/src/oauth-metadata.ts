import type { ResolvedOAuthProviderConfig } from './oauth-provider'

export interface OAuthAuthorizationServerMetadata {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  revocation_endpoint: string
  response_types_supported: string[]
  grant_types_supported: string[]
  code_challenge_methods_supported: string[]
  token_endpoint_auth_methods_supported: string[]
  revocation_endpoint_auth_methods_supported: string[]
  scopes_supported: string[]
}

function clientAuthenticationMethods(provider: ResolvedOAuthProviderConfig): string[] {
  const methods: string[] = []
  if (provider.clientTypes.includes('confidential'))
    methods.push('client_secret_basic')
  if (provider.clientTypes.includes('public'))
    methods.push('none')
  return methods
}

/** Build RFC 8414 metadata from the provider profile Stacks actually serves. */
export function oauthAuthorizationServerMetadata(
  provider: ResolvedOAuthProviderConfig,
): OAuthAuthorizationServerMetadata {
  const clientMethods = clientAuthenticationMethods(provider)

  return {
    issuer: provider.issuer,
    authorization_endpoint: provider.endpoints.authorization,
    token_endpoint: provider.endpoints.token,
    revocation_endpoint: provider.endpoints.revocation,
    response_types_supported: [...provider.responseTypes],
    grant_types_supported: [...provider.grantTypes],
    code_challenge_methods_supported: [...provider.codeChallengeMethods],
    token_endpoint_auth_methods_supported: [...clientMethods],
    revocation_endpoint_auth_methods_supported: [...clientMethods],
    scopes_supported: Object.keys(provider.scopes).sort(),
  }
}
