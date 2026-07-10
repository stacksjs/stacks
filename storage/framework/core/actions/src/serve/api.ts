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
 *   - HOST: Server hostname (default: 0.0.0.0 for production)
 *   - APP_ENV: Environment (production, staging, development)
 */

import type { Middleware } from '@stacksjs/router'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { frameworkPath } from '@stacksjs/path'
import { route } from '@stacksjs/router'

/**
 * Resolve a file from the scaffold defaults tree. A vendored checkout has it at
 * `storage/framework/defaults/<rel>` (source of truth) which wins; an app that
 * consumes the framework from node_modules has no vendored copy, so fall back to
 * the published `@stacksjs/defaults` package (which ships `app/` + `resources/`).
 */
function resolveDefaultsFile(rel: string): string {
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

const isProduction = process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production'

// Production defaults
const port = Number(process.env.PORT) || config.ports?.api || 3008
const hostname = process.env.HOST || (isProduction ? '0.0.0.0' : '127.0.0.1')

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
