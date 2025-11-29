// Mark as binary mode to prevent auto-registration in routes/api.ts
;(globalThis as any).__STACKS_BINARY_MODE__ = true

// IMPORTANT: Import router package first to ensure it's initialized before routes
import { Router, serve } from '@stacksjs/router'
import config from './config-production'

// Create the router instance HERE in start.ts before importing routes
// This ensures the router exists before registerRoutes is called
const route = new Router()

// Store on globalThis so routes can access it if needed
;(globalThis as any).__STACKS_ROUTER__ = route

// Now import routes after router is created
import { registerRoutes } from '../../../../../routes/api'

console.log('[START] Application starting...')
console.log('[START] Node version:', process.version)
console.log('[START] Working directory:', process.cwd())
console.log('[START] Environment:', process.env.APP_ENV || 'not set')

// Disable runtime config loading for compiled binary
process.env.SKIP_CONFIG_LOADING = 'true'

console.log('[START] Config loaded:', {
  port: config.server.port,
  host: config.server.host,
  appName: config.app.name,
  appUrl: config.app.url,
})

// Register routes and start the server
console.log('[START] Registering routes...')
console.log('[START] Route object:', route ? 'defined' : 'undefined')
registerRoutes(route)
  .then(() => {
    console.log('[START] Routes registered successfully')
    console.log('[START] Calling serve()...')
    try {
      serve({
        port: config.server.port,
        host: config.server.host,
        router: route,
      })
      console.log('[START] serve() called successfully')
    } catch (error) {
      console.error('[START] ERROR calling serve():', error)
      process.exit(1)
    }
  })
  .catch((error) => {
    console.error('[START] ERROR registering routes:', error)
    process.exit(1)
  })
