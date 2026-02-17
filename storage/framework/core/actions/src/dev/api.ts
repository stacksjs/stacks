import { parseOptions } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { cors, route } from '@stacksjs/router'

const options = parseOptions()
const port = config.ports?.api || 3008

// Enable CORS middleware
route.use(cors().handle.bind(cors()))

// Import routes
await route.importRoutes()

// Start server (URL shown by unified dev output)
await route.serve({
  port,
  hostname: '127.0.0.1',
})
