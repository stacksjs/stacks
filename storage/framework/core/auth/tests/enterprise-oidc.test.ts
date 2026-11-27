import type { EnterpriseOidcConfig } from '../src/enterprise-oidc'
import { expect, test } from 'bun:test'
import { enterpriseOidcAuthorization, enterpriseOidcChallenge, verifyEnterpriseOidcCallback } from '../src/enterprise-oidc'

const issuer = 'https://identity.example.test'
const defaultEndpoints = { authorizationEndpoint: issuer + '/authorize', tokenEndpoint: issuer + '/token', jwksUri: issuer + '/jwks' }
const splitEndpoints = {
  authorizationEndpoint: 'https://pool.auth.us-east-1.amazoncognito.com/oauth2/authorize',
  tokenEndpoint: 'https://pool.auth.us-east-1.amazoncognito.com/oauth2/token',
  jwksUri: defaultEndpoints.jwksUri,
}
const keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
const jwk = { ...await crypto.subtle.exportKey('jwk', keys.publicKey), kid: 'test-key', alg: 'RS256', use: 'sig' }
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
async function jwt(claims: Record<string, unknown>, unsigned = false) {
  const body = `${encode({ alg: unsigned ? 'none' : 'RS256', kid: 'test-key' })}.${encode(claims)}`
  return `${body}.${unsigned ? '' : Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(body))).toString('base64url')}`
}
function fixture(claims: Record<string, unknown> = {}, unsigned = false, endpoints = defaultEndpoints) {
  const challenge = enterpriseOidcChallenge()
  const calls: string[] = []
  const config = { issuer, clientId: 'client', clientSecret: 'fixture-secret', redirectUri: 'https://support.example.test/api/enterprise/callback', fetch: (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input); calls.push(url)
    if (url === issuer + '/.well-known/openid-configuration') return Response.json({ issuer, authorization_endpoint: endpoints.authorizationEndpoint, token_endpoint: endpoints.tokenEndpoint, jwks_uri: endpoints.jwksUri, response_types_supported: ['code'], subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256'] })
    if (url === endpoints.jwksUri) return Response.json({ keys: [jwk] })
    expect(url).toBe(endpoints.tokenEndpoint)
    const body = new URLSearchParams(String(init!.body))
    expect(body.get('code_verifier')).toBe(challenge.verifier)
    expect(body.get('client_secret')).toBe('fixture-secret')
    return Response.json({ access_token: 'provider-access', token_type: 'Bearer', id_token: await jwt({ iss: issuer, sub: 'immutable-123', aud: 'client', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300, nonce: challenge.nonce, email: 'agent@example.test', email_verified: true, ...claims }, unsigned) })
  }) as typeof fetch }
  const callback = `${config.redirectUri}?code=provider-code&state=${challenge.state}`
  return { config, challenge, callback, calls }
}

test('enterprise OIDC uses S256 PKCE and verifies signed issuer, audience and nonce', async () => {
  const f = fixture()
  const authorization = new URL(await enterpriseOidcAuthorization(f.config, f.challenge))
  expect(authorization.searchParams.get('code_challenge_method')).toBe('S256')
  expect(authorization.searchParams.get('nonce')).toBe(f.challenge.nonce)
  expect(await verifyEnterpriseOidcCallback(f.config, f.callback, f.challenge)).toEqual({ issuer, subject: 'immutable-123', email: 'agent@example.test', emailVerified: true })
  expect(f.calls).toContain(issuer + '/jwks')
})
for (const [name, claims] of [['issuer', { iss: 'https://attacker.example.test' }], ['audience', { aud: 'another-client' }], ['nonce', { nonce: 'wrong' }], ['expiry', { exp: 1 }]] as const) {
  test(`enterprise OIDC refuses wrong ${name}`, async () => {
    const f = fixture(claims)
    await expect(verifyEnterpriseOidcCallback(f.config, f.callback, f.challenge)).rejects.toThrow()
  })
}
test('enterprise OIDC refuses unsigned tokens and foreign callback/state', async () => {
  const f = fixture({}, true)
  await expect(verifyEnterpriseOidcCallback(f.config, f.callback, f.challenge)).rejects.toThrow()
  await expect(verifyEnterpriseOidcCallback(f.config, f.callback.replace('state=', 'state=wrong'), f.challenge)).rejects.toThrow()
  await expect(verifyEnterpriseOidcCallback(f.config, f.callback.replace('support.example.test', 'foreign.example.test'), f.challenge)).rejects.toThrow()
})

test('enterprise OIDC rejects a corrupted signature after valid token claim parsing', async () => {
  const f = fixture()
  const original = f.config.fetch
  f.config.fetch = (async (...args: Parameters<typeof fetch>) => {
    const response = await original(...args)
    if (String(args[0]).endsWith('/token')) {
      const body = await response.json() as { id_token: string }
      const parts = body.id_token.split('.')
      parts[2] = (parts[2]!.startsWith('A') ? 'B' : 'A') + parts[2]!.slice(1)
      return Response.json({ ...body, id_token: parts.join('.') })
    }
    return response
  }) as typeof fetch
  await expect(verifyEnterpriseOidcCallback(f.config, f.callback, f.challenge)).rejects.toThrow()
})

test('enterprise OIDC refuses cross-origin discovery endpoints before code exchange', async () => {
  const f = fixture()
  const original = f.config.fetch
  f.config.fetch = (async (...args: Parameters<typeof fetch>) => {
    const response = await original(...args)
    if (String(args[0]).endsWith('/.well-known/openid-configuration')) return Response.json({ ...await response.json() as object, token_endpoint: 'https://another-origin.example/token' })
    return response
  }) as typeof fetch
  await expect(enterpriseOidcAuthorization(f.config, f.challenge)).rejects.toThrow()
  expect(f.calls).not.toContain(issuer + '/token')
})

test('enterprise OIDC uses the explicitly approved login and token endpoints with issuer signing keys', async () => {
  const f = fixture({}, false, splitEndpoints)
  const { authorizationEndpoint, tokenEndpoint } = splitEndpoints
  const config: EnterpriseOidcConfig = { ...f.config, approvedEndpoints: { authorizationEndpoint, tokenEndpoint } }
  const authorization = new URL(await enterpriseOidcAuthorization(config, f.challenge))
  expect(authorization.origin + authorization.pathname).toBe(authorizationEndpoint)
  expect(authorization.searchParams.get('code_challenge_method')).toBe('S256')
  expect(await verifyEnterpriseOidcCallback(config, f.callback, f.challenge)).toEqual({ issuer, subject: 'immutable-123', email: 'agent@example.test', emailVerified: true })
  expect(f.calls).toEqual([issuer + '/.well-known/openid-configuration', issuer + '/.well-known/openid-configuration', tokenEndpoint, defaultEndpoints.jwksUri])
})

test('enterprise OIDC checks each approval before sending the code or credentials', async () => {
  const { authorizationEndpoint, tokenEndpoint } = splitEndpoints
  for (const approvedEndpoints of [
    { authorizationEndpoint },
    { authorizationEndpoint: tokenEndpoint, tokenEndpoint: authorizationEndpoint },
    { authorizationEndpoint, tokenEndpoint: tokenEndpoint + '/other' },
    { authorizationEndpoint, tokenEndpoint: tokenEndpoint.replace('https:', 'http:') },
    { authorizationEndpoint, tokenEndpoint, jwksUri: defaultEndpoints.jwksUri + '/other' },
  ]) {
    const f = fixture({}, false, splitEndpoints)
    const config: EnterpriseOidcConfig = { ...f.config, approvedEndpoints }
    await expect(verifyEnterpriseOidcCallback(config, f.callback, f.challenge)).rejects.toThrow()
    expect(f.calls).toEqual([issuer + '/.well-known/openid-configuration'])
  }
})

test('enterprise OIDC accepts explicitly approved signing keys on a separate origin', async () => {
  const jwksUri = 'https://keys.example.test/pool/.well-known/jwks.json'
  const f = fixture({}, false, { ...defaultEndpoints, jwksUri })
  const config: EnterpriseOidcConfig = { ...f.config, approvedEndpoints: { jwksUri } }
  expect(await verifyEnterpriseOidcCallback(config, f.callback, f.challenge)).toMatchObject({ issuer, subject: 'immutable-123' })
  expect(f.calls).toEqual([issuer + '/.well-known/openid-configuration', defaultEndpoints.tokenEndpoint, jwksUri])
})

test('enterprise OIDC refuses a redirect from an explicitly approved token endpoint', async () => {
  const f = fixture({}, false, splitEndpoints)
  const original = f.config.fetch
  f.config.fetch = (async (...args: Parameters<typeof fetch>) => {
    if (String(args[0]) === splitEndpoints.tokenEndpoint) {
      f.calls.push(splitEndpoints.tokenEndpoint)
      expect(args[1]?.redirect).toBe('error')
      return Response.redirect('https://unapproved.example.test/token', 307)
    }
    return await original(...args)
  }) as typeof fetch
  const config: EnterpriseOidcConfig = { ...f.config, approvedEndpoints: splitEndpoints }
  await expect(verifyEnterpriseOidcCallback(config, f.callback, f.challenge)).rejects.toThrow('OIDC endpoint redirects are not allowed.')
  expect(f.calls).toEqual([issuer + '/.well-known/openid-configuration', splitEndpoints.tokenEndpoint])
})
