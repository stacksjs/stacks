type StacksBrowserGlobal = typeof globalThis & {
  __STACKS_API_URL__?: string
}

/**
 * Resolve the public API root without exposing server environment state to
 * browser bundles.
 *
 * The framework may inject a custom URL for split-origin deployments.
 * Otherwise browser clients use the same-origin `/api` router, which is also
 * how the dashboard dev server delegates application API requests.
 */
export function resolveApiBaseUrl(defaultPath = '/api'): string {
  const configured = (globalThis as StacksBrowserGlobal).__STACKS_API_URL__
  if (configured)
    return configured.replace(/\/+$/, '')

  if (typeof window !== 'undefined')
    return `${window.location.origin}${defaultPath}`

  return defaultPath
}
