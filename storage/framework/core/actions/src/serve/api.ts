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
import { cors, route } from '@stacksjs/router'

const isProduction = process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production'

// Production defaults
const port = Number(process.env.PORT) || config.ports?.api || 3008
const hostname = process.env.HOST || (isProduction ? '0.0.0.0' : '127.0.0.1')

console.log(`[Stacks API] Starting server...`)
console.log(`[Stacks API] Environment: ${process.env.APP_ENV || 'development'}`)

// Enable CORS middleware
route.use(cors().handle.bind(cors()))

// Import routes
await route.importRoutes()

// Start server
await route.serve({
  port,
  hostname,
})

console.log(`[Stacks API] Server running at http://${hostname}:${port}`)
