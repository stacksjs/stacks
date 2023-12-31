import process from 'node:process'
import { ExitCode } from 'src/types/src'
import { runCommand } from 'src/cli/src'
import { logger } from 'src/logging/src'
import { projectPath } from 'src/path/src'
import { cleanProject } from 'src/utils/src'

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
