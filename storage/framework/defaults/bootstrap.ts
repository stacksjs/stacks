/**
 * Framework Bootstrap
 *
 * Single source of truth for which framework packages are wired into
 * boot. Each entry below either:
 *
 *   1. Imports a framework package whose `index.ts` self-registers via
 *      `route.register(...)` on import — analogous to the service
 *      provider pattern other frameworks (competitors) use to give
 *      packages a chance to wire themselves up at boot. This is the
 *      preferred shape for packages that own their own routes,
 *      migrations, etc.
 *
 *   2. Registers a framework routes file directly via `route.register()`
 *      — used when a routes file isn't yet wrapped in its own package.
 *
 * Adding a new framework package? Add a line here. There is no
 * filesystem scanning, no auto-discovery: this file is the entire
 * grep-able answer to "what does the framework load on boot?".
 *
 * @see storage/framework/core/router/src/route-loader.ts:loadFrameworkRoutes
 */

import { feature } from '@stacksjs/config'
import { frameworkPath } from '@stacksjs/path'
import { route } from '@stacksjs/router'
import MaintenanceMiddleware from './app/Middleware/Maintenance'

// RBAC: wire the bun-query-builder-backed store so `hasRole(user, …)` and
// friends from `@stacksjs/auth` actually hit the database (otherwise every
// call throws "RBAC store not configured"). The store is a thin adapter
// over the `roles` / `permissions` / `user_roles` / `user_permissions` /
// `role_permissions` tables created by migrations 0000000101–0000000105.
// Registered unconditionally because the auth middleware + Role middleware
// both reach for the helpers at request time regardless of which feature
// the project opts into.
import { createBqbRbacStore, setRbacStore } from '@stacksjs/auth'

setRbacStore(createBqbRbacStore())

// Global maintenance / coming-soon gate. Registered first so the
// `buddy down` / `buddy coming-soon` (and their env-var equivalents)
// state files intercept every request before any other middleware or
// route runs.
//
// The middleware is a thin wrapper around `maintenanceGate()` in
// @stacksjs/server, which is also called from the dev server's
// `onRequest` hook — so dev and prod use one implementation. The gate
// itself reads `activeSiteModePayload()` so it covers both maintenance
// and coming-soon modes (plus `APP_MAINTENANCE` / `APP_COMING_SOON`
// env overrides) without the bootstrap needing to know the details.
//
// `toRouterHandler()` adapts the Middleware contract (return void to
// continue, throw a Response to short-circuit) to bun-router's
// `(req, next) => Response` shape. Without the adapter, `handle` would
// return `undefined`, bun-router's chain treats that as a short-circuit
// to an empty 200, and every route returns `200 OK Content-Length: 0`.
route.use(MaintenanceMiddleware.toRouterHandler() as any)

// Locale cookie + STX-style path redirect (`/locale/en` → `/en/…`).
// Overridable by registering the same path in app routes first.
await route.register(frameworkPath('defaults/routes/core.ts'))

// Feature-gated route registration. The dashboard.ts file currently bundles
// ~687 lines covering auth, password reset, email subscribe, storefront
// cart/checkout, reviews, sitemap, AI, voice, and the admin dashboard's
// REST surface. Until that file is split per-feature (auth.ts, marketing.ts,
// commerce.ts, monitoring.ts), the whole thing loads when `dashboard` is
// activated and stays inert otherwise.
//
// Apps that need only a slice — e.g. a marketing site that wants
// `/api/email/subscribe` and `/api/contact` but not the rest — can either
//   1. Activate `dashboard` and live with the over-broad register; the
//      action handlers for routes you don't hit never fire, and their
//      models stay un-loaded as long as the corresponding feature flag
//      (`commerce`, `cms`, `monitoring`) is off, so there's no hidden
//      cost beyond the bun-router route-table entries.
//   2. Define the routes they want directly in `routes/api.ts` —
//      first-registration-wins means the user version takes priority.
//
// Once the per-feature route split lands, each `if (feature('X'))` block
// below registers just the X-specific routes file.
if (feature('dashboard')) {
  await route.register(frameworkPath('defaults/routes/dashboard.ts'))
  // JSON endpoints for the dev dashboard UI. Kept separate from the view
  // routes above so the data layer is one obvious file to grep.
  await route.register(frameworkPath('defaults/routes/dashboard-api.ts'))
}

// Email webhook + unsubscribe routes (stacksjs/stacks#1881, #1880).
// Always mounted when the `email` feature is on — the underlying
// handlers self-disable when their provider credentials aren't
// configured (they 401 rather than processing). Apps that need a
// non-default mount path register their own routes in `routes/api.ts`
// and the framework's mount silently no-ops since user routes
// register first.
if (feature('email')) {
  await route.register(frameworkPath('defaults/routes/email.ts'))
}
