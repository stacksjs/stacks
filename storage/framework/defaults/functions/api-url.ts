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

  /*
   * `window.location`, not just `window`.
   *
   * A global named `window` is not proof of a DOM. Test harnesses assign
   * `globalThis.window = globalThis` to make browser code importable off-DOM,
   * and that object has no `location` - so the guard passed and the very next
   * property read threw `undefined is not an object`. Callers compute this at
   * MODULE scope (`monitoring/errors.ts` builds its `baseURL` there), so the
   * throw happened on import, before any code could catch it: it surfaced as an
   * unhandled error between tests, attributed to no test at all
   * (stacksjs/stacks#2421).
   *
   * Reading the origin defensively costs nothing in a real browser and keeps
   * this resolvable anywhere - a worker, SSR, a partial DOM shim - where the
   * honest answer is the relative default.
   */
  const origin = typeof window !== 'undefined' ? window.location?.origin : undefined
  if (origin)
    return `${origin}${defaultPath}`

  return defaultPath
}
