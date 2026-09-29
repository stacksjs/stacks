import type { OAuthAuthorizationClientRegistration } from './oauth-authorization'
import { isValidOAuthRedirectUri } from './oauth-authorization'

export interface StoredOAuthAuthorizationClient {
  id: number | string
  secret: string | null
  redirect: string
  client_type: string | null
  redirect_uris: string | null
  grant_types: string | null
  token_endpoint_auth_method: string | null
  allowed_scopes: string | null
  allowed_resources: string | null
  personal_access_client: boolean | number
  password_client: boolean | number
  revoked: boolean | number
}

export function storedOAuthValues(value: string | null): string[] | null {
  if (value == null) return null
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) && parsed.every(item => typeof item === 'string') ? parsed : null
  }
  catch {
    return null
  }
}

export function isInactiveOAuthFlag(value: boolean | number): boolean {
  return value === false || value === 0
}

function storedOAuthFlag(value: boolean | number): boolean | null {
  if (isInactiveOAuthFlag(value)) return false
  if (value === true || value === 1) return true
  return null
}

export function oauthAuthorizationClientFromStored(
  row: StoredOAuthAuthorizationClient | undefined,
  id: number,
): OAuthAuthorizationClientRegistration | null {
  const redirectUris = storedOAuthValues(row?.redirect_uris ?? null)
  const grantTypes = storedOAuthValues(row?.grant_types ?? null)
  const scopes = storedOAuthValues(row?.allowed_scopes ?? null)
  const resources = storedOAuthValues(row?.allowed_resources ?? null)
  const revoked = row ? storedOAuthFlag(row.revoked) : null
  const type = row?.client_type
  const method = row?.token_endpoint_auth_method
  if (!row || String(row.id) !== String(id)
    || (type !== 'public' && type !== 'confidential')
    || (method !== 'none' && method !== 'client_secret_basic')
    || (type === 'public' ? method !== 'none' || row.secret != null : method !== 'client_secret_basic' || !row.secret)
    || !redirectUris?.length || !grantTypes?.includes('authorization_code') || !scopes?.length || !resources
    || new Set(redirectUris).size !== redirectUris.length
    || new Set(grantTypes).size !== grantTypes.length
    || new Set(scopes).size !== scopes.length
    || new Set(resources).size !== resources.length
    || redirectUris.some(uri => !isValidOAuthRedirectUri(uri))
    || row.redirect !== redirectUris[0]
    || !isInactiveOAuthFlag(row.personal_access_client)
    || !isInactiveOAuthFlag(row.password_client)
    || revoked == null)
    return null

  return { id, type, revoked, redirectUris, grantTypes, scopes, resources }
}
