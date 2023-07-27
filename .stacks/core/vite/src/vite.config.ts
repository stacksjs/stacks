import { alias } from '@stacksjs/alias'
import { path as p } from '@stacksjs/path'
import { defineConfig } from 'vite'
import { uiEngine } from './plugin/ui-engine'
import { autoImports } from './plugin/auto-imports'
import { cssEngine } from './plugin/css-engine'
import { inspect } from './plugin/inspect'
import app from '~/config/app'

// import { sslCertificate } from './plugin/ssl-cert' -> NotImplementedError: node:http2 createSecureServer is not yet implemented in Bun. Track the status & thumbs up the issue: https://github.com/oven-sh/bun/issues/887

const config = {
  server: {
    host: app.url || 'stacks.test',
    // host: 'stacks.test',
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
}

export default defineConfig(({ command }) => {
  console.log('loading env', command)

  loadEnv(command, p.projectPath())
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
