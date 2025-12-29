// Mark as binary mode to prevent auto-registration in routes/api.ts
;(globalThis as any).__STACKS_BINARY_MODE__ = true

// IMPORTANT: Import router package first to ensure it's initialized before routes
import { loadRoutes, Router, serve } from '@stacksjs/router'
import config from './config-production'
import routeRegistry from '../../../../../app/Routes'

// Create the router instance HERE in start.ts before importing routes
// This ensures the router exists before registerRoutes is called
const route = new Router()

// Store on globalThis so routes can access it if needed
;(globalThis as any).__STACKS_ROUTER__ = route

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

// Load routes from the registry and start the server
console.log('[START] Loading routes from registry...')
loadRoutes(routeRegistry)
  .then(() => {
    console.log('[START] Routes loaded successfully')
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
    console.error('[START] ERROR loading routes:', error)
    process.exit(1)
  })
