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

import process from 'node:process'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { cors, route } from '@stacksjs/router'

const isProduction = process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production'

// Production defaults
const port = Number(process.env.PORT) || config.ports?.api || 3008
const hostname = process.env.HOST || (isProduction ? '0.0.0.0' : '127.0.0.1')

log.info(`[Stacks API] Starting server...`)
log.info(`[Stacks API] Environment: ${process.env.APP_ENV || 'development'}`)

// Enable CORS middleware. We hold ONE Cors instance so `handle.bind(...)`
// targets the same object the method was read from — the previous
// `cors().handle.bind(cors())` form constructed two separate instances
// and bound across them, which silently broke if `Cors` ever held
// per-instance state (stacksjs/stacks#1863 T-11).
const corsMiddleware = cors()
route.use(corsMiddleware.handle.bind(corsMiddleware))

// Import routes
await route.importRoutes()

// Start server
await route.serve({
  port,
  hostname,
})

log.info(`[Stacks API] Server running at http://${hostname}:${port}`)
