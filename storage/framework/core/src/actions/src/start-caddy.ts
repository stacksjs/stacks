import { handleError } from '@stacksjs/error-handling'
import { runCommand } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'

// eslint-disable-next-line no-console
console.log('Starting Caddy...')

const result = await runCommand('caddy run', {
  cwd: p.frameworkPath(),
})

if (result.isErr())
  handleError(result.error)
