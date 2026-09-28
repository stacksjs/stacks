import { Buffer } from 'node:buffer'

export type OAuthTokenRequestErrorCode
  = | 'invalid_client'
    | 'invalid_request'
    | 'unsupported_grant_type'
    | 'unsupported_token_type'

export interface OAuthClientCredentials {
  clientId: number
  clientSecret?: string
}

export interface OAuthAuthorizationCodeTokenRequest {
  grantType: 'authorization_code'
  clientId: number
  clientSecret?: string
  code: string
  redirectUri: string
  codeVerifier: string
}

export interface OAuthRefreshTokenRequest {
  grantType: 'refresh_token'
  clientId: number
  clientSecret?: string
  refreshToken: string
  scopes?: string[]
}

export type OAuthTokenRequest = OAuthAuthorizationCodeTokenRequest | OAuthRefreshTokenRequest

export interface OAuthRevocationRequest extends OAuthClientCredentials {
  token: string
  tokenTypeHint?: 'access_token' | 'refresh_token'
}

export class OAuthTokenRequestError extends Error {
  constructor(
    public readonly error: OAuthTokenRequestErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'OAuthTokenRequestError'
  }
}

function reject(error: OAuthTokenRequestErrorCode, message: string): never {
  throw new OAuthTokenRequestError(error, message)
}

function single(params: URLSearchParams, name: string, required = false): string | undefined {
  const values = params.getAll(name)
  if (values.length > 1)
    reject('invalid_request', `OAuth token parameter must not be repeated: ${name}`)
  const value = values[0]
  if (required && !value)
    reject('invalid_request', `OAuth token parameter is required: ${name}`)
  if (value?.includes('\uFFFD'))
    reject('invalid_request', `OAuth token parameter is not valid UTF-8: ${name}`)
  return value
}

function clientIdentifier(value: string): number {
  if (!/^[0-9]{1,20}$/.test(value))
    reject('invalid_client', 'OAuth client identifier is invalid.')
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0)
    reject('invalid_client', 'OAuth client identifier is invalid.')
  return id
}

function decodeCredential(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '))
  }
  catch {
    return reject('invalid_client', 'OAuth client credentials are malformed.')
  }
}

function basicCredentials(header: string): { clientId: number, clientSecret: string } {
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(header)
  if (!match)
    reject('invalid_client', 'OAuth client authentication must use a valid Basic header.')

  const encoded = match[1]!
  let bytes: Buffer
  try {
    bytes = Buffer.from(encoded, 'base64')
  }
  catch {
    return reject('invalid_client', 'OAuth client credentials are malformed.')
  }
  if (bytes.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, ''))
    reject('invalid_client', 'OAuth client credentials are malformed.')

  let decoded: string
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  }
  catch {
    return reject('invalid_client', 'OAuth client credentials are not valid UTF-8.')
  }
  const separator = decoded.indexOf(':')
  if (separator < 1)
    reject('invalid_client', 'OAuth client credentials are malformed.')
  const clientId = clientIdentifier(decodeCredential(decoded.slice(0, separator)))
  const clientSecret = decodeCredential(decoded.slice(separator + 1))
  if (!clientSecret || clientSecret.length > 4096)
    reject('invalid_client', 'OAuth client secret is invalid.')
  return { clientId, clientSecret }
}

function clientCredentials(params: URLSearchParams, authorization?: string | null): OAuthClientCredentials {
  const bodyClientId = single(params, 'client_id')
  const bodyClientSecret = single(params, 'client_secret')
  if (authorization) {
    if (bodyClientId !== undefined || bodyClientSecret !== undefined)
      reject('invalid_request', 'OAuth client authentication methods must not be combined.')
    return basicCredentials(authorization)
  }
  if (bodyClientSecret !== undefined)
    reject('invalid_request', 'OAuth client secrets must use Basic authentication.')
  return { clientId: clientIdentifier(bodyClientId ?? '') }
}

function tokenValue(params: URLSearchParams, name: string): string {
  const value = single(params, name, true)!
  if (value.length > 4096 || /\s/.test(value))
    reject('invalid_request', `OAuth token parameter is invalid: ${name}`)
  return value
}

function requestedScopes(params: URLSearchParams): string[] | undefined {
  const value = single(params, 'scope')
  if (value === undefined)
    return undefined
  const scopes = value.split(' ')
  if (scopes.some(scope => !/^[\x21\x23-\x5B\x5D-\x7E]+$/.test(scope)) || new Set(scopes).size !== scopes.length)
    reject('invalid_request', 'OAuth refresh scope must contain unique scope tokens.')
  return scopes
}

/** Parse one form-encoded token request without accepting mixed client authentication methods. */
export function parseOAuthTokenRequest(body: string, authorization?: string | null): OAuthTokenRequest {
  if (body.length > 16_384)
    reject('invalid_request', 'OAuth token request is too large.')
  const params = new URLSearchParams(body)
  for (const name of [
    'grant_type',
    'client_id',
    'client_secret',
    'code',
    'redirect_uri',
    'code_verifier',
    'refresh_token',
    'scope',
  ]) single(params, name)

  const credentials = clientCredentials(params, authorization)

  const grantType = single(params, 'grant_type', true)
  if (grantType === 'authorization_code') {
    const codeVerifier = single(params, 'code_verifier', true)!
    if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(codeVerifier))
      reject('invalid_request', 'OAuth PKCE verifier is invalid.')
    const redirectUri = single(params, 'redirect_uri', true)!
    if (redirectUri.length > 2048)
      reject('invalid_request', 'OAuth redirect URI is too large.')
    return {
      grantType,
      ...credentials,
      code: tokenValue(params, 'code'),
      redirectUri,
      codeVerifier,
    }
  }
  if (grantType === 'refresh_token') {
    const scopes = requestedScopes(params)
    return {
      grantType,
      ...credentials,
      refreshToken: tokenValue(params, 'refresh_token'),
      ...(scopes ? { scopes } : {}),
    }
  }
  return reject('unsupported_grant_type', 'OAuth grant type is not supported.')
}

/** Parse one RFC 7009 revocation request through the token endpoint's client-authentication rules. */
export function parseOAuthRevocationRequest(body: string, authorization?: string | null): OAuthRevocationRequest {
  if (body.length > 16_384)
    reject('invalid_request', 'OAuth revocation request is too large.')
  const params = new URLSearchParams(body)
  for (const name of ['client_id', 'client_secret', 'token', 'token_type_hint'])
    single(params, name)

  const credentials = clientCredentials(params, authorization)
  const token = tokenValue(params, 'token')
  const tokenTypeHint = single(params, 'token_type_hint')
  if (tokenTypeHint !== undefined && tokenTypeHint !== 'access_token' && tokenTypeHint !== 'refresh_token')
    reject('unsupported_token_type', 'OAuth revocation token type is not supported.')

  return {
    ...credentials,
    token,
    ...(tokenTypeHint ? { tokenTypeHint } : {}),
  }
}
