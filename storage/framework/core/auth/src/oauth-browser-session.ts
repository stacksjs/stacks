import type { ResolvedOAuthProviderConfig } from './oauth-provider'
import { randomBytes } from 'node:crypto'

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/
const HTTPS_COOKIE_NAME = '__Host-stacks-oauth-session'
const LOOPBACK_COOKIE_NAME = 'stacks-oauth-session'

export interface OAuthAuthorizationBrowserSession {
  /** Opaque browser binding stored only as a hash with authorization state. */
  id: string
  /** Refreshed host-only cookie to include on the authorization response. */
  cookie: string
}

function isHttps(provider: ResolvedOAuthProviderConfig): boolean {
  return new URL(provider.issuer).protocol === 'https:'
}

/** Cookie name is `__Host-` protected except on permitted loopback HTTP. */
export function oauthAuthorizationBrowserSessionCookieName(provider: ResolvedOAuthProviderConfig): string {
  return isHttps(provider) ? HTTPS_COOKIE_NAME : LOOPBACK_COOKIE_NAME
}

function requestSessionId(request: Request, name: string): string | null {
  const matches = (request.headers.get('cookie') ?? '')
    .split(';')
    .map(cookie => cookie.trim())
    .filter(Boolean)
    .flatMap((cookie) => {
      const separator = cookie.indexOf('=')
      if (separator <= 0 || cookie.slice(0, separator).trim() !== name)
        return []
      return [cookie.slice(separator + 1).trim()]
    })

  return matches.length === 1 && SESSION_ID_PATTERN.test(matches[0]!) ? matches[0]! : null
}

/**
 * Resolve the stable, pre-auth browser binding used through login and 2FA.
 *
 * The browser never submits OAuth callback or identity authority. It carries
 * only this random HttpOnly value while the database stores its SHA-256 hash.
 * Reissuing the cookie refreshes its lifetime for a newly started request.
 */
export function oauthAuthorizationBrowserSession(
  request: Request,
  provider: ResolvedOAuthProviderConfig,
): OAuthAuthorizationBrowserSession {
  const name = oauthAuthorizationBrowserSessionCookieName(provider)
  const id = requestSessionId(request, name) ?? randomBytes(32).toString('base64url')
  const maxAge = Math.ceil(provider.lifetimes.authorizationRequest / 1000)
  if (!Number.isSafeInteger(maxAge) || maxAge <= 0)
    throw new TypeError('OAuth authorization request lifetime cannot be represented as cookie seconds.')

  return {
    id,
    cookie: [
      `${name}=${id}`,
      'Path=/',
      `Max-Age=${maxAge}`,
      'HttpOnly',
      'SameSite=Lax',
      ...(isHttps(provider) ? ['Secure'] : []),
    ].join('; '),
  }
}
