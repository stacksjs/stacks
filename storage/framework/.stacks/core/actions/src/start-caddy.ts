import { handleError } from 'stacks:error-handling'
import { runCommand } from 'stacks:cli'
import { path as p } from 'stacks:path'

console.log('Starting Caddy...')

const result = await runCommand('caddy run', {
  cwd: p.frameworkPath(),
})

if (result.isErr())
  handleError(result.error)
