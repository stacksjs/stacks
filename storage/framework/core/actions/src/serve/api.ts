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
import process from 'node:process'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { frameworkPath } from '@stacksjs/path'
import { route } from '@stacksjs/router'

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
const corsMod = await import(frameworkPath('defaults/app/Middleware/Cors.ts'))
const corsMiddleware: Middleware = corsMod.default
route.use(corsMiddleware.toRouterHandler())

// Import routes
await route.importRoutes()

// Start server
await route.serve({
  port,
  hostname,
})

log.info(`[Stacks API] Server running at http://${hostname}:${port}`)
