import { parseOptions } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { cors, route } from '@stacksjs/router'

const options = parseOptions()

// Enable CORS middleware
route.use(cors().handle.bind(cors()))

// Import routes
await route.importRoutes()

// Start server
await route.serve({
  port: config.ports?.api || 3008,
  hostname: '127.0.0.1',
})
