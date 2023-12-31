import { path as p } from 'src/path/src'
import { log, parseOptions, runCommand } from 'src/cli/src'
import { serve } from 'src/router/src'

const options = parseOptions()

if (options.verbose)
  log.info('Running API dev server via', `bunx --bun vite --config ${p.vitePath('src/api.ts')}`, options)

serve({
  port: config.app.ports?.api, // defaults to 3999
})

// we need this proxied by vite
await runCommand(`bunx --bun vite --config ${p.vitePath('src/api.ts')}`, {
  // ...options,
  cwd: p.frameworkPath(),
})
