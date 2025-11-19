import { log } from '@stacksjs/cli'
import { serve } from 'bun-plugin-stx/serve'

// Run stx dev server for resources/views
// This serves .stx templates from the project's resources/views directory
const viewsPath = 'resources/views'
const preferredPort = 3456

log.success(`🚀 Starting STX development server on http://localhost:${preferredPort}\n`)

// Start the server directly - no subprocess overhead!
await serve({
  patterns: [viewsPath],
  port: preferredPort,
})
