import { log, runCommand } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { ExitCode, NpmScript } from '@stacksjs/types'

log.info('Running clean command...')

const result = await runCommand(NpmScript.Clean, { cwd: projectPath() })

if (result.isOk()) {
  log.success('Cleaned up')
  process.exit(ExitCode.Success)
}

log.error(result.error)
process.exit(ExitCode.FatalError)
