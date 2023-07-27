import { alias } from '@stacksjs/alias'
import { defineConfig } from 'vite'
import { uiEngine } from './.stacks/core/vite/src/plugin/ui-engine'
import { autoImports } from './.stacks/core/vite/src/plugin/auto-imports'
import { cssEngine } from './.stacks/core/vite/src/plugin/css-engine'
import { inspect } from './.stacks/core/vite/src/plugin/inspect'

// import app from './config/app'
// import { sslCertificate } from './.stacks/core/vite/src/plugin/ssl-cert' -> NotImplementedError: node:http2 createSecureServer is not yet implemented in Bun. Track the status & thumbs up the issue: https://github.com/oven-sh/bun/issues/887

export default defineConfig({
  server: {
    // host: app.url || 'stacks.test',
    host: 'stacks.test',
    open: true,
  },

  resolve: {
    dedupe: ['vue'],
    alias,
  },

  optimizeDeps: {
    exclude: ['vue'],
  },

  plugins: [
    uiEngine(),
    autoImports(),
    cssEngine(), // blocked by: unconfig uses jiti which errors in Bun: https://github.com/oven-sh/bun/issues/1134#issuecomment-1652676500
    inspect(),
    // sslCertificate(), // blocked by: node:http2 not yet implemented in Bun
  ],
})
