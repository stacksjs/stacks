import { expect, test } from 'bun:test'
import { enterpriseOidcAuthorization, enterpriseOidcChallenge, verifyEnterpriseOidcCallback } from '../src/enterprise-oidc'

const issuer = 'https://identity.example.test'
const keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
const jwk = { ...await crypto.subtle.exportKey('jwk', keys.publicKey), kid: 'test-key', alg: 'RS256', use: 'sig' }
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
async function jwt(claims: Record<string, unknown>, unsigned = false) {
  const body = `${encode({ alg: unsigned ? 'none' : 'RS256', kid: 'test-key' })}.${encode(claims)}`
  return `${body}.${unsigned ? '' : Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(body))).toString('base64url')}`
}
function fixture(claims: Record<string, unknown> = {}, unsigned = false) {
  const challenge = enterpriseOidcChallenge()
  const calls: string[] = []
  const config = { issuer, clientId: 'client', clientSecret: 'fixture-secret', redirectUri: 'https://support.example.test/api/enterprise/callback', fetch: (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input); calls.push(url)
    if (url.endsWith('/.well-known/openid-configuration')) return Response.json({ issuer, authorization_endpoint: issuer + '/authorize', token_endpoint: issuer + '/token', jwks_uri: issuer + '/jwks', response_types_supported: ['code'], subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256'] })
    if (url.endsWith('/jwks')) return Response.json({ keys: [jwk] })
    expect(url).toBe(issuer + '/token')
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
