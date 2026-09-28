import type {
  OAuthProviderConfig,
  OAuthProviderResourceConfig,
  OAuthProviderScopeConfig,
} from '@stacksjs/types'

const DEFAULT_LIFETIMES = {
  authorizationCode: 10 * 60 * 1000,
  accessToken: 60 * 60 * 1000,
  refreshToken: 30 * 24 * 60 * 60 * 1000,
} as const

const DEFAULT_ENDPOINTS = {
  authorization: 'oauth/authorize',
  token: 'oauth/token',
  revocation: 'oauth/revoke',
  introspection: 'oauth/introspect',
} as const

export interface ResolvedOAuthProviderConfig {
  enabled: true
  issuer: string
  endpoints: {
    authorization: string
    token: string
    revocation: string
    introspection: string
  }
  responseTypes: readonly ['code']
  grantTypes: readonly ['authorization_code', 'refresh_token']
  codeChallengeMethods: readonly ['S256']
  clientTypes: readonly ('confidential' | 'public')[]
  scopes: Record<string, OAuthProviderScopeConfig>
  resources: Record<string, OAuthProviderResourceConfig>
  lifetimes: {
    authorizationCode: number
    accessToken: number
    refreshToken: number
  }
  consent: {
    rememberFor: number
    view: string
  }
}

function canonicalIssuer(value: string | undefined): URL {
  if (!value)
    throw new Error('OAuth provider is enabled but `auth.oauthProvider.issuer` is not configured.')

  let issuer: URL
  try {
    issuer = new URL(value)
  }
  catch {
    throw new Error('`auth.oauthProvider.issuer` must be an absolute URL.')
  }

  if (issuer.username || issuer.password)
    throw new Error('`auth.oauthProvider.issuer` must not contain credentials.')
  if (issuer.search || issuer.hash)
    throw new Error('`auth.oauthProvider.issuer` must not contain a query or fragment.')

  const loopback = issuer.hostname === 'localhost'
    || issuer.hostname === '127.0.0.1'
    || issuer.hostname === '[::1]'
  if (issuer.protocol !== 'https:' && !(issuer.protocol === 'http:' && loopback))
    throw new Error('`auth.oauthProvider.issuer` must use HTTPS outside loopback development.')

  issuer.pathname = issuer.pathname.replace(/\/+$/, '') || '/'
  return issuer
}

function endpoint(issuer: URL, configured: string | undefined, fallback: string): string {
  const resolved = new URL(configured ?? fallback, `${issuer.toString().replace(/\/+$/, '')}/`)
  if (resolved.origin !== issuer.origin)
    throw new Error('OAuth provider endpoints must share the configured issuer origin.')
  if (resolved.username || resolved.password || resolved.search || resolved.hash)
    throw new Error('OAuth provider endpoints must not contain credentials, a query, or a fragment.')
  return resolved.toString().replace(/\/$/, '')
}

function positiveLifetime(name: string, value: number): number {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`auth.oauthProvider.lifetimes.${name} must be a positive number of milliseconds.`)
  return value
}

/**
 * Resolve the disabled-by-default OAuth authorization-server contract.
 *
 * The initial provider profile is intentionally fixed to authorization code
 * with S256 PKCE and rotating refresh tokens. Implicit and password grants are
 * not configurable options, so enabling the provider cannot advertise them by
 * accident. Routes consume this resolver before registration and therefore do
 * not exist while the provider is absent or disabled.
 */
export function resolveOAuthProviderConfig(
  options?: OAuthProviderConfig,
): ResolvedOAuthProviderConfig | null {
  if (options?.enabled !== true)
    return null

  const issuer = canonicalIssuer(options.issuer)
  const lifetimes = {
    authorizationCode: positiveLifetime(
      'authorizationCode',
      options.lifetimes?.authorizationCode ?? DEFAULT_LIFETIMES.authorizationCode,
    ),
    accessToken: positiveLifetime(
      'accessToken',
      options.lifetimes?.accessToken ?? DEFAULT_LIFETIMES.accessToken,
    ),
    refreshToken: positiveLifetime(
      'refreshToken',
      options.lifetimes?.refreshToken ?? DEFAULT_LIFETIMES.refreshToken,
    ),
  }

  return {
    enabled: true,
    issuer: issuer.toString().replace(/\/$/, ''),
    endpoints: {
      authorization: endpoint(issuer, options.endpoints?.authorization, DEFAULT_ENDPOINTS.authorization),
      token: endpoint(issuer, options.endpoints?.token, DEFAULT_ENDPOINTS.token),
      revocation: endpoint(issuer, options.endpoints?.revocation, DEFAULT_ENDPOINTS.revocation),
      introspection: endpoint(issuer, options.endpoints?.introspection, DEFAULT_ENDPOINTS.introspection),
    },
    responseTypes: ['code'],
    grantTypes: ['authorization_code', 'refresh_token'],
    codeChallengeMethods: ['S256'],
    clientTypes: options.clientTypes ?? ['confidential', 'public'],
    scopes: options.scopes ?? {},
    resources: options.resources ?? {},
    lifetimes,
    consent: {
      rememberFor: options.consent?.rememberFor ?? 0,
      view: options.consent?.view ?? 'auth/oauth/consent',
    },
  }
}
