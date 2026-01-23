import { log } from '@stacksjs/cli'
import { serve } from 'bun-plugin-stx/serve'

// Run stx dev server for resources/views
// This serves .stx templates from the project's resources/views directory
// User views override default views - check user path first, then defaults
const userViewsPath = 'resources/views'
const defaultViewsPath = 'storage/framework/defaults/resources/views'
const userLayoutsPath = 'resources/layouts'
const defaultLayoutsPath = 'storage/framework/defaults/resources/layouts'
const preferredPort = 3456

log.success(`🚀 Starting STX development server on http://localhost:${preferredPort}\n`)

// Start the server directly - no subprocess overhead!
// Patterns are checked in order: user views first, then defaults
await serve({
  patterns: [userViewsPath, defaultViewsPath],
  port: preferredPort,
  componentsDir: 'storage/framework/defaults/components/Dashboard',
  layoutsDir: userLayoutsPath,
  partialsDir: userViewsPath,
  // Additional fallback layouts from defaults
  fallbackLayoutsDir: defaultLayoutsPath,
  fallbackPartialsDir: defaultViewsPath,
})
