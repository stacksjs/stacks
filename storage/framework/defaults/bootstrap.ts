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
// DEFERRED, non-blocking wiring on purpose. This file is dynamically
// imported by the route loader while other entrypoints (a test file, the
// API server) may still be mid-way through evaluating the @stacksjs/auth
// async module graph. With a static `import { setRbacStore } ...`, Bun
// could execute this module against auth's partially-evaluated record:
// the exported function exists (hoisted) but rbac.ts's module-level
// `let store` hadn't initialized, so calling it threw
// `Cannot access 'store' before initialization`, the whole bootstrap
// import failed, and EVERY framework default route (auth, 2FA, passkeys,
// dashboard) silently vanished — the loader logs one line and carries
// on. A blocking `await import('@stacksjs/auth')` here deadlocks instead
// (auth's evaluation can be waiting on the same route-loading pass that
// is importing this file), so the wiring is fire-and-forget: routes
// register immediately, and the RBAC store lands the moment auth's
// evaluation completes — before any real request needs it.
import('@stacksjs/auth')
  .then(({ createBqbRbacStore, setRbacStore }) => setRbacStore(createBqbRbacStore()))
  .catch(err => console.error('[bootstrap] RBAC store wiring failed:', err))

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

// Which default route bundles this app mounts. The route loader resolves the
// selection (STACKS_DEFAULT_ROUTES, or the legacy STACKS_SKIP_DEFAULT_ROUTES)
// and leaves it here; see `resolveDefaultRouteBundles` in
// `core/router/src/route-loader.ts`. Absent when bootstrap is imported by
// something other than the loader, in which case every bundle is eligible and
// the feature gates below decide, exactly as before.
const selection = (globalThis as Record<string, unknown>).__stacksDefaultRouteBundles as
  { bundles: Set<string>, explicit: boolean } | undefined

/**
 * Whether a bundle mounts.
 *
 * An app that NAMED its bundles has already answered the question, so the
 * feature flag does not get a second veto - otherwise `STACKS_DEFAULT_ROUTES=auth`
 * would still be withheld from an app running with `dashboard` off, which is
 * the exact case this exists for. When nothing was named, the flags gate
 * precisely as they did before.
 */
function mounts(bundle: string, featureEnabled: boolean): boolean {
  if (selection && !selection.bundles.has(bundle))
    return false
  return selection?.explicit ? true : featureEnabled
}

// Auth: login, registration, logout, refresh/revoke, passkeys, TOTP 2FA and
// password reset. Split out of dashboard.ts so it can be mounted on its own
// (stacksjs/stacks#2229) — previously the only way to get `/login` was to
// activate `dashboard` and take the storefront, reviews, AI and voice surface
// with it.
//
// Registered BEFORE dashboard.ts, which is where these lived, so the
// first-registration-wins order among framework routes is unchanged.
//
// Deliberately NOT gated on `feature('auth')`, despite the issue asking for
// it: `config/auth.ts` ships in every app with `enabled: true`, so that gate
// is true everywhere and would mount the auth surface — including
// `/generate-two-factor-secret`, `/logout-all` and `/auth/tokens` — in apps
// currently running with `dashboard` off. Widening an app's public surface on
// upgrade is not something a refactor gets to do silently.
if (mounts('auth', feature('dashboard')))
  await route.register(frameworkPath('defaults/routes/auth.ts'))

// The rest of dashboard.ts: email subscribe, storefront cart/checkout,
// reviews, sitemap, AI, voice, and the admin dashboard's REST surface. Still
// one file and still one gate — splitting auth out was the case with a
// reporter behind it; marketing.ts / commerce.ts / monitoring.ts remain the
// obvious next cuts.
//
// Apps that need only a slice can also define the routes they want directly
// in `routes/api.ts` — first-registration-wins means the user version takes
// priority.
if (mounts('dashboard', feature('dashboard'))) {
  await route.register(frameworkPath('defaults/routes/dashboard.ts'))
  // JSON endpoints for the dev dashboard UI. Kept separate from the view
  // routes above so the data layer is one obvious file to grep.
  await route.register(frameworkPath('defaults/routes/dashboard-api.ts'))
  // The dev dashboard boots through this file rather than the application
  // router's importRoutes() path, so load model-declared useApi routes here too.
  await import(frameworkPath('orm/routes.ts'))
}

// Email webhook + unsubscribe routes (stacksjs/stacks#1881, #1880).
// Always mounted when the `email` feature is on — the underlying
// handlers self-disable when their provider credentials aren't
// configured (they 401 rather than processing). Apps that need a
// non-default mount path register their own routes in `routes/api.ts`
// and the framework's mount silently no-ops since user routes
// register first.
if (mounts('email', feature('email'))) {
  await route.register(frameworkPath('defaults/routes/email.ts'))
}

// Social sign-in: `/auth/{provider}` + `/auth/{provider}/callback`
// (stacksjs/stacks#2276). An opt-in bundle, NOT part of the implicit default
// set or `all` — OAuth callback URLs in an app that configured no provider
// are surface for nothing. So `mounts()` does not apply here: an app that
// NAMED its bundles decides outright (`social` listed → on, absent → off),
// and an app that said nothing gets it exactly when a provider is actually
// configured in config/services.ts — configuring GitHub and finding
// /auth/github dead would be the puzzle, not the mount.
const { configuredSocialProviders } = await import('@stacksjs/socials')
const mountSocial = selection?.explicit
  ? selection.bundles.has('social')
  : configuredSocialProviders().length > 0
if (mountSocial) {
  await route.register(frameworkPath('defaults/routes/socials.ts'))
}
