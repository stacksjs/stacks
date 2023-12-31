import { handleError } from 'src/error-handling/src'
import { runCommand } from 'src/cli/src'
import { path as p } from 'src/path/src'

// eslint-disable-next-line no-console
console.log('Starting Caddy...')

const result = await runCommand('caddy run', {
  cwd: p.frameworkPath(),
})

if (result.isErr())
  handleError(result.error)
