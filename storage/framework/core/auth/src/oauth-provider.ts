import type {
  OAuthProviderConfig,
  OAuthProviderResourceConfig,
  OAuthProviderScopeConfig,
} from '@stacksjs/types'

const DEFAULT_LIFETIMES = {
  authorizationRequest: 10 * 60 * 1000,
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
    authorizationRequest: number
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
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`auth.oauthProvider.lifetimes.${name} must be a positive safe integer of milliseconds.`)
  return value
}

const POLICY_TOKEN = /^[\x21\x23-\x5B\x5D-\x7E]+$/

function resolvedResources(
  configured: Record<string, OAuthProviderResourceConfig> | undefined,
): Record<string, OAuthProviderResourceConfig> {
  const resources: Record<string, OAuthProviderResourceConfig> = {}
  const audiences = new Set<string>()
  for (const [key, resource] of Object.entries(configured ?? {})) {
    if (!POLICY_TOKEN.test(key))
      throw new Error(`auth.oauthProvider resource key is not a valid policy token: ${key}`)

    let audience: URL
    try {
      audience = new URL(resource.audience)
    }
    catch {
      throw new Error(`auth.oauthProvider resource audience must be an absolute URI: ${key}`)
    }
    if (audience.username || audience.password || audience.hash)
      throw new Error(`auth.oauthProvider resource audience must not contain credentials or a fragment: ${key}`)
    if (audiences.has(resource.audience))
      throw new Error(`auth.oauthProvider resources must each have a unique audience: ${resource.audience}`)
    audiences.add(resource.audience)
    resources[key] = {
      audience: resource.audience,
      ...(resource.description === undefined ? {} : { description: resource.description }),
    }
  }
  return resources
}

function resolvedScopes(
  configured: Record<string, OAuthProviderScopeConfig> | undefined,
  resources: Record<string, OAuthProviderResourceConfig>,
): Record<string, OAuthProviderScopeConfig> {
  const scopes: Record<string, OAuthProviderScopeConfig> = {}
  for (const [key, scope] of Object.entries(configured ?? {})) {
    if (!POLICY_TOKEN.test(key))
      throw new Error(`auth.oauthProvider scope is not a valid OAuth scope token: ${key}`)
    if (!scope.description?.trim())
      throw new Error(`auth.oauthProvider scope description must not be empty: ${key}`)

    const scopeResources = [...(scope.resources ?? [])]
    if (new Set(scopeResources).size !== scopeResources.length)
      throw new Error(`auth.oauthProvider scope contains a duplicate resource: ${key}`)
    for (const resource of scopeResources) {
      if (!resources[resource])
        throw new Error(`auth.oauthProvider scope references an unknown resource: ${key} -> ${resource}`)
    }
    scopes[key] = {
      description: scope.description,
      ...(scope.resources === undefined ? {} : { resources: scopeResources }),
    }
  }
  return scopes
}

function resolvedClientTypes(
  configured: readonly ('confidential' | 'public')[] | undefined,
): readonly ('confidential' | 'public')[] {
  const clientTypes = [...(configured ?? ['confidential', 'public'] as const)]
  if (!clientTypes.length || new Set(clientTypes).size !== clientTypes.length
    || clientTypes.some(type => type !== 'confidential' && type !== 'public'))
    throw new Error('auth.oauthProvider.clientTypes must contain unique supported client types.')
  return clientTypes
}

function resolvedConsent(options: OAuthProviderConfig['consent']): ResolvedOAuthProviderConfig['consent'] {
  const rememberFor = options?.rememberFor ?? 0
  if (!Number.isSafeInteger(rememberFor) || rememberFor < 0)
    throw new Error('auth.oauthProvider.consent.rememberFor must be a non-negative safe integer of milliseconds.')
  const view = options?.view ?? 'auth/oauth/consent'
  if (!view || view.length > 255 || view.startsWith('/') || view.includes('..') || /[\u0000-\u001F\u007F]/.test(view))
    throw new Error('auth.oauthProvider.consent.view must be a safe relative view name.')
  return { rememberFor, view }
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
  const resources = resolvedResources(options.resources)
  const scopes = resolvedScopes(options.scopes, resources)
  const lifetimes = {
    authorizationRequest: positiveLifetime(
      'authorizationRequest',
      options.lifetimes?.authorizationRequest ?? DEFAULT_LIFETIMES.authorizationRequest,
    ),
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
  const endpoints = {
    authorization: endpoint(issuer, options.endpoints?.authorization, DEFAULT_ENDPOINTS.authorization),
    token: endpoint(issuer, options.endpoints?.token, DEFAULT_ENDPOINTS.token),
    revocation: endpoint(issuer, options.endpoints?.revocation, DEFAULT_ENDPOINTS.revocation),
    introspection: endpoint(issuer, options.endpoints?.introspection, DEFAULT_ENDPOINTS.introspection),
  }
  if (new Set(Object.values(endpoints)).size !== Object.keys(endpoints).length)
    throw new Error('auth.oauthProvider endpoints must each use a unique URL.')

  return {
    enabled: true,
    issuer: issuer.toString().replace(/\/$/, ''),
    endpoints,
    responseTypes: ['code'],
    grantTypes: ['authorization_code', 'refresh_token'],
    codeChallengeMethods: ['S256'],
    clientTypes: resolvedClientTypes(options.clientTypes),
    scopes,
    resources,
    lifetimes,
    consent: resolvedConsent(options.consent),
  }
}
