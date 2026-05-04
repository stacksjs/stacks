/**
 * useNavigation — dashboard navigation helpers.
 *
 * Wraps the SSR-safe `navigate` / `goBack` / `goForward` primitives from
 * `@stacksjs/stx/composables` so dashboard pages don't reach into
 * `window.location` / `window.history` directly. Adds a few feature-area
 * shorthands (`goToCustomer`, `goToOrder`, …) for the most common
 * intra-dashboard hops; one-off paths can still use plain `navigate(url)`.
 *
 * Why a wrapper instead of importing the stx primitives directly:
 * routes evolve (e.g. `/dashboard/commerce/customers/:id` → some
 * day `/dashboard/customers/:id`). Centralising route construction
 * means a rename is one file, not 173.
 */
import { goBack, goForward, navigate } from '@stacksjs/stx/composables'

const BASE = '/dashboard'

function withQuery(path: string, query?: Record<string, string | number | boolean | undefined>): string {
  if (!query) return path
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue
    params.set(k, String(v))
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

export interface UseNavigationApi {
  /** Raw navigate — falls back to `window.location.href` if no SPA router. */
  to: (url: string) => void
  back: () => void
  forward: () => void
  /** Build a dashboard-relative path without navigating. Useful for `<a href>`. */
  href: (path: string, query?: Record<string, string | number | boolean | undefined>) => string

  // Feature-area shorthands — extend as we sweep more pages.
  goToCustomer: (id: string | number, opts?: { edit?: boolean }) => void
  goToOrder: (id: string | number) => void
  goToProduct: (id: string | number) => void
  goToGiftCard: (id: string | number) => void
  goToPayment: (id: string | number) => void
}

export function useNavigation(): UseNavigationApi {
  return {
    to: navigate,
    back: goBack,
    forward: goForward,
    href: (path, query) => withQuery(`${BASE}${path.startsWith('/') ? path : `/${path}`}`, query),

    goToCustomer: (id, opts) =>
      navigate(withQuery(`${BASE}/commerce/customers/${id}`, opts?.edit ? { edit: 'true' } : undefined)),
    goToOrder: id => navigate(`${BASE}/commerce/orders/${id}`),
    goToProduct: id => navigate(`${BASE}/commerce/products/${id}`),
    goToGiftCard: id => navigate(`${BASE}/commerce/gift-cards/${id}`),
    goToPayment: id => navigate(`${BASE}/commerce/payments/${id}`),
  }
}
