import { log, parseOptions, runCommand } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { path as p } from '@stacksjs/path'
import { serve } from '@stacksjs/router'
import { initiateImports } from '@stacksjs/server'

const options = parseOptions()

log.debug('Running API dev server via', `bunx --bun vite --config ${p.viteConfigPath('src/api.ts')}`, options)

initiateImports()

serve({
  port: config.ports?.api, // defaults to 3008
})

// the reason we start a Vite dev server next is because we need the Bun server proxied by vite
await runCommand(`bunx --bun vite --config ${p.viteConfigPath('src/api.ts')}`, {
  // ...options,
  cwd: p.frameworkPath(),
})
