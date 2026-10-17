import { expect, test } from 'bun:test'
import { parseDynamicOAuthRegistration } from '../src/oauth-dynamic-registration'
import { oauthAuthorizationServerMetadata } from '../src/oauth-metadata'
import { oauthAuthorizationConsentResponse, oauthAuthorizationRequestErrorResponse } from '../src/oauth-authorization-response'
import { OAuthAuthorizationRequestError } from '../src/oauth-authorization'
import { oauthProtectedResourceMetadata, oauthProtectedResourceMetadataPath } from '../src/oauth-protected-resource'
import { resolveOAuthProviderConfig } from '../src/oauth-provider'
import { parseOAuthTokenRequest } from '../src/oauth-token-request'

const provider = resolveOAuthProviderConfig({ enabled: true, issuer: 'https://hq.example', dynamicRegistration: { allowedRedirectOrigins: ['https://chatgpt.com', 'https://claude.ai'] }, scopes: { 'workouts:read': { description: 'Read workouts', resources: ['mcp'] } }, resources: { mcp: { audience: 'https://hq.example/api/mcp' } } })!

test('DCR policy accepts exact registered client callbacks and refuses unsafe grants or origins', () => {
  expect(oauthAuthorizationServerMetadata(provider).registration_endpoint).toBe('https://hq.example/oauth/register')
  const input = { client_name: 'ChatGPT', token_endpoint_auth_method: 'none', redirect_uris: ['https://chatgpt.com/connector/callback'], grant_types: ['authorization_code', 'refresh_token'] }
  expect(parseDynamicOAuthRegistration(provider, input)).toMatchObject({ type: 'public', scopes: ['workouts:read'], resources: ['mcp'], requiresSecret: false })
  for (const changes of [{ redirect_uris: ['https://chatgpt.com.attacker.test/callback'] }, { redirect_uris: ['https://chatgpt.com/callback#fragment'] }, { grant_types: ['client_credentials'] }, { scope: 'admin' }, { token_endpoint_auth_method: 'client_secret_post' }, { response_types: ['token'] }]) expect(() => parseDynamicOAuthRegistration(provider, { ...input, ...changes })).toThrow()
})

test('protected resource metadata binds discovery to the exact canonical MCP audience', () => {
  expect(oauthProtectedResourceMetadataPath('https://hq.example/api/mcp')).toBe('/.well-known/oauth-protected-resource/api/mcp')
  expect(oauthProtectedResourceMetadata({ resource: 'https://hq.example/api/mcp', authorizationServers: [provider.issuer] })).toMatchObject({ resource: 'https://hq.example/api/mcp', authorization_servers: ['https://hq.example'], bearer_methods_supported: ['header'] })
  expect(() => oauthProtectedResourceMetadata({ resource: 'http://public.example/mcp', authorizationServers: [provider.issuer] })).toThrow()
})

test('token requests retain RFC 8707 resource indicators and reject ambiguous values', () => {
  const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: '42', code: 'code', redirect_uri: 'https://chatgpt.com/cb', code_verifier: 'a'.repeat(43), resource: 'https://hq.example/api/mcp' })
  expect(parseOAuthTokenRequest(body.toString()).audiences).toEqual(['https://hq.example/api/mcp'])
  body.append('resource', 'https://hq.example/api/mcp')
  expect(() => parseOAuthTokenRequest(body.toString())).toThrow()
})

test('issuer identification is present on success and error callbacks, including SPA completion', async () => {
  const result = { code: 'code', grantId: 'grant', state: 'opaque', redirectUri: 'https://chatgpt.com/callback?iss=attacker' }
  const response = oauthAuthorizationConsentResponse(result, provider.issuer)
  expect(new URL(response.headers.get('location')!).searchParams.get('iss')).toBe(provider.issuer)
  const json = await oauthAuthorizationConsentResponse(result, provider.issuer, { json: true }).json()
  expect(new URL(json.redirect_uri).searchParams.get('iss')).toBe(provider.issuer)
  const error = oauthAuthorizationRequestErrorResponse(new OAuthAuthorizationRequestError('invalid_scope', 'private', result.redirectUri, 'opaque'), provider.issuer)!
  expect(new URL(error.headers.get('location')!).searchParams.get('iss')).toBe(provider.issuer)
})
