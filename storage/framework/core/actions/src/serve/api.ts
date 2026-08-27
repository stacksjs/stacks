/**
 * Production API Server Entry Point
 *
 * This is the entry point for deploying the Stacks API.
 * Similar to Laravel's public/index.php
 *
 * Deploy with:
 *   - Direct: bun run storage/framework/core/actions/src/serve/api.ts
 *   - Compiled: bun build --compile --minify storage/framework/core/actions/src/serve/api.ts --outfile api-server
 *
 * Environment variables:
 *   - PORT: Server port (default: 3008)
 *   - API_HOST / HOST: Server hostname (default: 0.0.0.0 for production)
 *   - APP_ENV: Environment (production, staging, development)
 */

import type { Middleware } from '@stacksjs/router'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { config, overridesReady } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { appPath, frameworkPath } from '@stacksjs/path'
import { disableViewRouting, route } from '@stacksjs/router'
import { resolveApiHost } from '../helpers/api-host'

/**
 * Resolve a file from the scaffold defaults tree.
 *
 * A published userland copy wins first: `buddy publish:middleware Cors` exists
 * so an app can own its CORS policy, and an override that the production API
 * server ignores is the worst of both worlds — the file reads as authoritative
 * and changes nothing. Then a vendored checkout's `storage/framework/defaults`;
 * then the published `@stacksjs/defaults` package (which ships `app/` +
 * `resources/`), which is all a node_modules app has.
 */
function resolveDefaultsFile(rel: string): string {
  if (rel.startsWith('app/')) {
    const published = appPath(rel.slice('app/'.length))
    if (existsSync(published))
      return published
  }

  const vendored = frameworkPath(`defaults/${rel}`)
  if (existsSync(vendored))
    return vendored
  try {
    const pkgJson = Bun.resolveSync('@stacksjs/defaults/package.json', process.cwd())
    return join(dirname(pkgJson), rel)
  }
  catch {
    return vendored
  }
}

// Installed projects load config/*.ts asynchronously. Wait before reading any
// section so production uses the same project config as dev and migrations.
await overridesReady

// Production defaults
const port = Number(process.env.PORT) || config.ports?.api || 3008
const hostname = resolveApiHost()

log.info(`[Stacks API] Starting server...`)
log.info(`[Stacks API] Environment: ${process.env.APP_ENV || 'development'}`)

// Enable CORS middleware.
//
// We mount the **Stacks** Cors middleware (`defaults/app/Middleware/Cors.ts`)
// rather than `bun-router`'s default `cors()`. The bun-router default
// shipped with `Access-Control-Allow-Origin: *` AND
// `Access-Control-Allow-Credentials: true` hardcoded together — the
// canonical "credentials + wildcard" anti-pattern that browsers
// block, and worse, leaked the rate-limit body cross-origin even
// when the configured CORS policy was restrictive. The Stacks
// middleware reads `config.cors` (when defined) or falls back to
// safe defaults: no credentials, no wildcard with credentials.
// See stacksjs/stacks#1859 R-1.
const corsMod = await import(resolveDefaultsFile('app/Middleware/Cors.ts'))
const corsMiddleware: Middleware = corsMod.default
route.use(corsMiddleware.toRouterHandler())

// Import routes
await route.importRoutes()

// Say which of the app's own root-mounted routes the views server will never
// forward, before this process starts answering. The route is registered here
// and the request is answered there, so a root `GET` that no proxy rule
// matches renders as a page, finds no page, and 404s - with the handler that
// would have answered it sitting in this process, unreached and unmentioned
// (stacksjs/stacks#2326). Best-effort: a diagnostic must never stop a boot.
try {
  const { describeUnforwardableRoutes, resolveApiProxyRules, unforwardableRoutes } = await import('@stacksjs/server')
  const { listRootMountedAppRoutes } = await import('@stacksjs/router')
  const unreachable = unforwardableRoutes(
    listRootMountedAppRoutes().filter(entry => entry.method === 'GET' || entry.method === 'HEAD'),
    resolveApiProxyRules((config as { server?: { proxy?: any } }).server?.proxy),
  )
  if (unreachable.length > 0)
    log.warn(describeUnforwardableRoutes(unreachable))
}
catch (error) {
  log.debug(`[Stacks API] Route reachability check skipped: ${error instanceof Error ? error.message : String(error)}`)
}

// This process answers JSON. Without this it also mounts a GET route for every
// `.stx` under `resources/views` — bun-router finds the directory on its own —
// and serves the whole site with no stylesheet and with every image 404ing,
// because there is no static handling here. `buddy serve` renders pages and
// reverse-proxies `/api/**` to this process; it is the proxy target, not a
// second page server. Runs after the route files so an app that asked for file
// routing itself keeps it (#2314).
disableViewRouting(route.bunRouter)

// Start server. `reusePort` (SO_REUSEPORT, Linux) lets a new release's
// instance bind the same port while the old one still serves — the
// overlap ts-cloud's zero-downtime cutover relies on. Enabled for every
// *deployed* environment (production, staging, development), each of which
// cuts over via the same templated systemd unit; off for local runs, where
// two servers fighting over one port should fail loudly with EADDRINUSE.
// bun-router spreads these options into Bun.serve verbatim.
const isDeployed = ['production', 'staging', 'development'].includes((process.env.APP_ENV || '').toLowerCase())
const server = await route.serve({
  port,
  hostname,
  reusePort: isDeployed,
} as Parameters<typeof route.serve>[0])

// Graceful drain for the zero-downtime cutover: when systemd stops the
// old release's instance (SIGTERM), stop accepting new connections but
// let in-flight requests finish; hard-exit after a grace window so a
// stuck keep-alive can't ride into systemd's SIGKILL mid-request.
process.on('SIGTERM', () => {
  const graceMs = Number(process.env.SHUTDOWN_GRACE_MS) || 15_000
  setTimeout(() => process.exit(0), graceMs).unref()
  Promise.resolve(server?.stop()).then(() => process.exit(0))
})

log.info(`[Stacks API] Server running at http://${hostname}:${port}`)
