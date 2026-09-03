type StacksBrowserGlobal = typeof globalThis & {
  __STACKS_API_URL__?: string
}

/**
 * Resolve the public API root without exposing server environment state to a
 * browser bundle. Split-origin deployments may inject an explicit root;
 * otherwise clients use the same-origin `/api` router.
 */
export function resolveApiBaseUrl(defaultPath = '/api'): string {
  const configured = (globalThis as StacksBrowserGlobal).__STACKS_API_URL__
  if (configured)
    return configured.replace(/\/+$/, '')

  const origin = typeof window !== 'undefined' ? window.location?.origin : undefined
  if (origin)
    return `${origin}${defaultPath}`

  return defaultPath
}

/**
 * Join a request path to an API root.
 *
 * Callers may pass either `/users` or the legacy `/api/users` form. When the
 * configured root already ends in `/api`, the latter is de-duplicated so an
 * app can migrate callers incrementally without ever requesting `/api/api/*`.
 * Absolute URLs are already fully resolved and pass through unchanged.
 */
export function resolveApiUrl(input: string, baseUrl = resolveApiBaseUrl()): string {
  if (/^https?:\/\//i.test(input))
    return input

  const base = baseUrl.replace(/\/+$/, '')
  let path = input.startsWith('/') ? input : `/${input}`

  if (base.endsWith('/api') && (path === '/api' || path.startsWith('/api/')))
    path = path.slice(4) || '/'

  return `${base}${path}`
}
