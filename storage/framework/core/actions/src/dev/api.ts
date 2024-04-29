import { log, parseOptions, runCommand } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { path as p } from '@stacksjs/path'
import { serve } from '@stacksjs/router'

const options = parseOptions()

log.debug(
  'Running API dev server via',
  `bunx vite --config ${p.viteConfigPath('src/api.ts')}`,
  options,
)

serve({
  port: config.ports?.api, // defaults to 3008
})

// the reason we start a Vite dev server next is because we need the Bun server proxied by vite
await runCommand(`bunx vite --config ${p.viteConfigPath('src/api.ts')}`, {
  // ...options,
  cwd: p.frameworkPath(),
})
