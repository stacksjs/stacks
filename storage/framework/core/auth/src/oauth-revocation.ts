import type { OAuthRevocationRequest } from './oauth-token-request'
import { createHash } from 'node:crypto'
import { db, getDatabaseDialect, sqlHelpers } from '@stacksjs/database/runtime'
import { withAuthenticatedOAuthTokenClient } from './oauth-client-registration'
import { OAuthTokenRequestError, parseOAuthRevocationRequest } from './oauth-token-request'
import { oauthTokenErrorResponse } from './oauth-token-response'
import { revokeTokenPair } from './token-revocation'

export interface OAuthRevocationEndpointRequest {
  body: string
  contentType?: string | null
  authorization?: string | null
}

interface TokenIdRow {
  id: number | string | bigint
}

const REVOCATION_HEADERS = {
  'Cache-Control': 'no-store',
  'Pragma': 'no-cache',
} as const

async function delegatedAccessTokenId(
  request: OAuthRevocationRequest,
  kind: 'access_token' | 'refresh_token',
): Promise<number | null> {
  if (!/^[a-f0-9]{80}$/.test(request.token))
    return null

  const sql = sqlHelpers(getDatabaseDialect())
  const hash = createHash('sha256').update(request.token).digest('hex')
  const lock = sql.isSqlite ? '' : ' FOR UPDATE'
  const rows = kind === 'access_token'
    ? await db.unsafe(`
        SELECT id FROM oauth_access_tokens
        WHERE token = ${sql.param(1)} AND oauth_client_id = ${sql.param(2)}
          AND oauth_grant_id IS NOT NULL
        LIMIT 1${lock}
      `, [hash, request.clientId]) as unknown as TokenIdRow[]
    : await db.unsafe(`
        SELECT a.id
        FROM oauth_refresh_tokens r
        JOIN oauth_access_tokens a ON a.id = r.access_token_id
        WHERE r.token = ${sql.param(1)} AND a.oauth_client_id = ${sql.param(2)}
          AND a.oauth_grant_id IS NOT NULL
        LIMIT 1${lock}
      `, [hash, request.clientId]) as unknown as TokenIdRow[]
  const id = Number(rows[0]?.id)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

async function revokeOAuthClientToken(request: OAuthRevocationRequest): Promise<void> {
  const order: Array<'access_token' | 'refresh_token'> = request.tokenTypeHint === 'refresh_token'
    ? ['refresh_token', 'access_token']
    : ['access_token', 'refresh_token']
  for (const kind of order) {
    const id = await delegatedAccessTokenId(request, kind)
    if (id == null)
      continue
    await revokeTokenPair({ id })
    return
  }
}

/** Execute one RFC 7009 revocation request without registering a route. */
export async function handleOAuthRevocationRequest(input: OAuthRevocationEndpointRequest): Promise<Response> {
  const basic = /^Basic\s/i.test(input.authorization ?? '')
  const responseOptions = { clientAuthenticatedWithBasic: basic, basicRealm: 'oauth-revoke' }
  const mediaType = input.contentType?.split(';', 1)[0]?.trim().toLowerCase()
  if (mediaType !== 'application/x-www-form-urlencoded')
    return oauthTokenErrorResponse('invalid_request', responseOptions)

  try {
    const request = parseOAuthRevocationRequest(input.body, input.authorization)
    const authenticated = await withAuthenticatedOAuthTokenClient(
      String(request.clientId),
      request.clientSecret,
      async () => {
        await revokeOAuthClientToken(request)
        return true
      },
    )
    if (!authenticated)
      return oauthTokenErrorResponse('invalid_client', responseOptions)
    return new Response(null, { status: 200, headers: REVOCATION_HEADERS })
  }
  catch (error) {
    if (error instanceof OAuthTokenRequestError)
      return oauthTokenErrorResponse(error.error, responseOptions)
    throw error
  }
}
