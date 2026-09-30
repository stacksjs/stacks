import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'bun:test'
import {
  OAuthTokenRequestError,
  parseOAuthIntrospectionRequest,
  parseOAuthRevocationRequest,
  parseOAuthTokenRequest,
} from '../src/oauth-token-request'

function basic(clientId: string, clientSecret: string): string {
  const credentials = `${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`
  return `Basic ${Buffer.from(credentials).toString('base64')}`
}

function requestError(body: string, authorization?: string): OAuthTokenRequestError {
  try {
    parseOAuthTokenRequest(body, authorization)
  }
  catch (error) {
    expect(error).toBeInstanceOf(OAuthTokenRequestError)
    return error as OAuthTokenRequestError
  }
  throw new Error('Expected OAuth token request parsing to fail.')
}

function revocationError(body: string, authorization?: string): OAuthTokenRequestError {
  try {
    parseOAuthRevocationRequest(body, authorization)
  }
  catch (error) {
    expect(error).toBeInstanceOf(OAuthTokenRequestError)
    return error as OAuthTokenRequestError
  }
  throw new Error('Expected OAuth revocation request parsing to fail.')
}

function introspectionError(body: string, authorization?: string): OAuthTokenRequestError {
  try {
    parseOAuthIntrospectionRequest(body, authorization)
  }
  catch (error) {
    expect(error).toBeInstanceOf(OAuthTokenRequestError)
    return error as OAuthTokenRequestError
  }
  throw new Error('Expected OAuth introspection request parsing to fail.')
}

describe('OAuth token request parsing', () => {
  it('parses a public authorization-code request without inventing a secret', () => {
    expect(parseOAuthTokenRequest(new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: '42',
      code: 'opaque-code',
      redirect_uri: 'https://client.example.com/callback',
      code_verifier: 'v'.repeat(43),
    }).toString())).toEqual({
      grantType: 'authorization_code',
      clientId: 42,
      code: 'opaque-code',
      redirectUri: 'https://client.example.com/callback',
      codeVerifier: 'v'.repeat(43),
    })
  })

  it('parses confidential Basic authentication and decodes each credential', () => {
    expect(parseOAuthTokenRequest(new URLSearchParams({
      grant_type: 'authorization_code',
      code: 'opaque-code',
      redirect_uri: 'https://client.example.com/callback',
      code_verifier: 'v'.repeat(43),
    }).toString(), basic('42', 'secret:with spaces'))).toEqual({
      grantType: 'authorization_code',
      clientId: 42,
      clientSecret: 'secret:with spaces',
      code: 'opaque-code',
      redirectUri: 'https://client.example.com/callback',
      codeVerifier: 'v'.repeat(43),
    })
  })

  it('parses refresh requests with an optional unique scope reduction', () => {
    expect(parseOAuthTokenRequest(new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: '42',
      refresh_token: 'r'.repeat(80),
      scope: 'issues:read profile:read',
    }).toString())).toEqual({
      grantType: 'refresh_token',
      clientId: 42,
      refreshToken: 'r'.repeat(80),
      scopes: ['issues:read', 'profile:read'],
    })
  })

  it('parses client-credentials requests only with Basic authentication', () => {
    expect(parseOAuthTokenRequest(new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'issues:read',
    }).toString(), basic('42', 'machine-secret'))).toEqual({
      grantType: 'client_credentials',
      clientId: 42,
      clientSecret: 'machine-secret',
      scopes: ['issues:read'],
    })

    expect(parseOAuthTokenRequest('grant_type=client_credentials', basic('42', 'machine-secret'))).toEqual({
      grantType: 'client_credentials',
      clientId: 42,
      clientSecret: 'machine-secret',
    })
  })

  it('parses introspection requests only with confidential Basic authentication', () => {
    expect(parseOAuthIntrospectionRequest(new URLSearchParams({
      token: 'a'.repeat(80),
      token_type_hint: 'access_token',
    }).toString(), basic('42', 'resource-secret'))).toEqual({
      clientId: 42,
      clientSecret: 'resource-secret',
      token: 'a'.repeat(80),
      tokenTypeHint: 'access_token',
    })
    expect(introspectionError('token=' + 'a'.repeat(80)).error).toBe('invalid_client')
  })

  it.each([
    ['grant_type=authorization_code&grant_type=refresh_token&client_id=42&code=x&redirect_uri=https%3A%2F%2Fclient.example.com%2Fcallback&code_verifier=v', undefined, 'invalid_request'],
    ['grant_type=authorization_code&client_id=42&client_secret=secret&code=x&redirect_uri=https%3A%2F%2Fclient.example.com%2Fcallback&code_verifier=v', undefined, 'invalid_request'],
    ['grant_type=authorization_code&client_id=42&client_secret=&code=x&redirect_uri=https%3A%2F%2Fclient.example.com%2Fcallback&code_verifier=v', undefined, 'invalid_request'],
    ['grant_type=authorization_code&client_id=42&code=x&redirect_uri=https%3A%2F%2Fclient.example.com%2Fcallback&code_verifier=v', basic('42', 'secret'), 'invalid_request'],
    ['grant_type=authorization_code&code=x&redirect_uri=https%3A%2F%2Fclient.example.com%2Fcallback&code_verifier=v', 'Basic !!!', 'invalid_client'],
    ['grant_type=password&client_id=42', undefined, 'unsupported_grant_type'],
    ['grant_type=client_credentials&client_id=42', undefined, 'invalid_client'],
    ['grant_type=refresh_token&client_id=42', undefined, 'invalid_request'],
    ['grant_type=refresh_token&client_id=42&refresh_token=token&scope=issues%3Aread+issues%3Aread', undefined, 'invalid_request'],
  ])('rejects ambiguous or unsupported token request %#', (body, authorization, expected) => {
    expect(requestError(body, authorization).error).toBe(expected)
  })
})

describe('OAuth revocation request parsing', () => {
  it('parses public and confidential client authentication without exposing ambiguity', () => {
    expect(parseOAuthRevocationRequest(new URLSearchParams({
      client_id: '42',
      token: 'a'.repeat(80),
    }).toString())).toEqual({ clientId: 42, token: 'a'.repeat(80) })
    expect(parseOAuthRevocationRequest(new URLSearchParams({
      token: 'b'.repeat(80),
      token_type_hint: 'refresh_token',
    }).toString(), basic('42', 'secret'))).toEqual({
      clientId: 42,
      clientSecret: 'secret',
      token: 'b'.repeat(80),
      tokenTypeHint: 'refresh_token',
    })
  })

  it.each([
    ['client_id=42&token=a&token=b', undefined, 'invalid_request'],
    ['client_id=42&client_secret=secret&token=a', undefined, 'invalid_request'],
    ['client_id=42&token=a', basic('42', 'secret'), 'invalid_request'],
    ['client_id=42&token=a&token_type_hint=id_token', undefined, 'unsupported_token_type'],
    ['client_id=42', undefined, 'invalid_request'],
  ])('rejects ambiguous or unsupported revocation request %#', (body, authorization, expected) => {
    expect(revocationError(body, authorization).error).toBe(expected)
  })
})
