import process from 'node:process'
import { runCommand } from '@stacksjs/cli'
import { handleError } from '@stacksjs/error-handling'
import { logger } from '@stacksjs/logging'
import { projectPath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { cleanProject } from '@stacksjs/utils'

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
