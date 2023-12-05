import process from 'node:process'
import { ExitCode } from 'stacks:types'
import { runCommand } from 'stacks:cli'
import { logger } from 'stacks:logging'
import { projectPath } from 'stacks:path'
import { cleanProject } from 'stacks:utils'

logger.log('Cleaning project...')
await cleanProject()

logger.log('Installing dependencies...')

const result = await runCommand('bun install', {
  cwd: projectPath(),
})

if (result.isErr()) {
  handleError(result.error)
  process.exit(ExitCode.FatalError)
}
