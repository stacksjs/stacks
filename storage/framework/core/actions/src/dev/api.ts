import { parseOptions } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { cors, route } from '@stacksjs/router'

const options = parseOptions()
const port = config.ports?.api || 3008

log.info('[API] Starting development server...')

// Enable CORS middleware
route.use(cors().handle.bind(cors()))

// Import routes
await route.importRoutes()

// Start server
await route.serve({
  port,
  hostname: '127.0.0.1',
})

log.success(`[API] Server running at http://127.0.0.1:${port}`)
log.info('[API] Hot reload enabled - changes will auto-restart the server')
