import type { ResolvedOAuthProviderConfig } from './oauth-provider'
import { OAuthClientRegistrationError, registerDynamicOAuthClient, validateOAuthClientRegistration } from './oauth-client-registration'

/** RFC 7591 metadata for an explicitly enabled authorization-code provider. No remote URLs are fetched. */
export function parseDynamicOAuthRegistration(provider: ResolvedOAuthProviderConfig, body: unknown) {
  if (!provider.dynamicRegistration || !body || typeof body !== 'object' || Array.isArray(body))
    throw new OAuthClientRegistrationError('Dynamic registration is unavailable or the metadata is invalid.')
  const input = body as Record<string, unknown>
  const strings = (value: unknown, fallback: string[]): string[] => {
    if (value === undefined) return fallback
    if (!Array.isArray(value) || value.length > 10 || !value.every(item => typeof item === 'string' && item.length <= 2048))
      throw new OAuthClientRegistrationError('Invalid client metadata array.')
    return value as string[]
  }
  const method = input.token_endpoint_auth_method ?? 'client_secret_basic'
  if (method !== 'none' && method !== 'client_secret_basic')
    throw new OAuthClientRegistrationError('Unsupported token endpoint authentication method.')
  const redirectUris = strings(input.redirect_uris, [])
  if (!redirectUris.length || redirectUris.some(uri => {
    try { return !provider.dynamicRegistration!.allowedRedirectOrigins.includes(new URL(uri).origin) }
    catch { return true }
  })) throw new OAuthClientRegistrationError('Redirect origin is not allowed.')
  const responseTypes = strings(input.response_types, ['code'])
  const grantTypes = strings(input.grant_types, ['authorization_code'])
  if (responseTypes.length !== 1 || responseTypes[0] !== 'code' || grantTypes.some(grant => !['authorization_code', 'refresh_token'].includes(grant)))
    throw new OAuthClientRegistrationError('Only the authorization-code profile is supported.')
  if (input.scope !== undefined && (typeof input.scope !== 'string' || input.scope.length > 4096))
    throw new OAuthClientRegistrationError('Invalid scope metadata.')
  if (input.client_name !== undefined && typeof input.client_name !== 'string')
    throw new OAuthClientRegistrationError('Invalid client name.')
  const scopes = typeof input.scope === 'string' ? input.scope.split(' ') : Object.keys(provider.scopes)
  return validateOAuthClientRegistration(provider, {
    name: typeof input.client_name === 'string' ? input.client_name : 'MCP client',
    type: method === 'none' ? 'public' : 'confidential', tokenEndpointAuthMethod: method,
    redirectUris, grantTypes, scopes, resources: Object.keys(provider.resources),
  })
}

/** The route must apply a bounded JSON read and an IP quota before calling this. */
export async function handleDynamicOAuthRegistration(provider: ResolvedOAuthProviderConfig, body: unknown): Promise<Response> {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Pragma: 'no-cache' }
  if (!provider.dynamicRegistration) return new Response(null, { status: 404, headers })
  try {
    const input = parseDynamicOAuthRegistration(provider, body)
    const result = await registerDynamicOAuthClient(provider, input)
    return Response.json({
      client_id: String(result.client.id), client_id_issued_at: Math.floor(result.client.createdAt.getTime() / 1000),
      client_name: result.client.name, redirect_uris: result.client.redirectUris,
      token_endpoint_auth_method: result.client.tokenEndpointAuthMethod,
      grant_types: result.client.grantTypes, response_types: ['code'], scope: result.client.scopes.join(' '),
      ...(result.plainTextSecret ? { client_secret: result.plainTextSecret, client_secret_expires_at: 0 } : {}),
    }, { status: 201, headers })
  }
  catch (error) {
    if (!(error instanceof OAuthClientRegistrationError)) throw error
    return Response.json({ error: 'invalid_client_metadata', error_description: error.message }, { status: 400, headers })
  }
}
