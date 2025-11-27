import { serve } from '@stacksjs/router'
import config from './config-production'

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

// Start the server with production config
console.log('[START] Calling serve()...')
try {
  serve({
    port: config.server.port,
    host: config.server.host,
  })
  console.log('[START] serve() called successfully')
} catch (error) {
  console.error('[START] ERROR calling serve():', error)
  process.exit(1)
}
