// Route registry types live in `@stacksjs/router` (the consumer) — see
// stacksjs/stacks#1863. Re-exported here for backwards compatibility
// with any project code that imports them via `app/Routes`.
import type { RouteDefinition, RouteRegistry } from '@stacksjs/router'

export type { RouteDefinition, RouteRegistry }

/**
 * Application route registry.
 *
 * Define your route files here. The key becomes the URL prefix
 * automatically. The `'web'` key is the only one that loads at root
 * (`/`) with no prefix — see the route-loader's `NO_PREFIX_KEYS` for
 * the canonical list.
 *
 * `'api'` auto-prefixes with `/api` so user routes line up with the
 * rpx proxy forward path (stacksjs/stacks#1835). Writing
 * `route.get('/cart/add', ...)` in `routes/api.ts` registers as
 * `/api/cart/add` — exactly what `https://<domain>/api/cart/add`
 * resolves to via the dev proxy.
 *
 * @example
 * // Default API routes - routes/api.ts loaded at /api/*
 * 'api': 'api',
 *
 * // Auto prefix from key - routes/v1.ts loaded at /v1/*
 * 'v1': 'v1',
 *
 * // Explicit prefix - routes/api/v1.ts loaded at /api/v1/*
 * 'legacy': { path: 'api/v1', prefix: '/api/v1' },
 *
 * // No prefix override - routes/internal.ts loaded at /* (no prefix)
 * 'internal': { path: 'internal', prefix: '' },
 *
 * // With middleware - routes/admin.ts loaded at /admin/* with auth
 * 'admin': { path: 'admin', middleware: ['auth'] },
 */
export default {
  // Default API routes — auto-prefixed with /api by the route-loader
  // so `routes/api.ts` aligns with the proxy forward path.
  'api': 'api',

  // Add versioned or prefixed routes here:
  'v1': { path: 'v1', prefix: 'v1' }
  // 'v2': 'api/v2',
  // 'admin': { path: 'admin', middleware: ['auth'] },
} satisfies RouteRegistry
