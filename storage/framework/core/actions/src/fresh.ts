import process from 'node:process'
import { runCommand } from '@stacksjs/cli'
import { handleError } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { projectPath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { cleanProject } from '@stacksjs/utils'

log.info('Cleaning project...')
await cleanProject()

log.info('Installing dependencies...')
const result = await runCommand('bun install', {
  cwd: projectPath(),
})

if (result.isErr()) {
  handleError(result.error)
  process.exit(ExitCode.FatalError)
}
