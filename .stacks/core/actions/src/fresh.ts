import process from 'node:process'
import { ExitCode } from '@stacksjs/types'
import { log, runCommands } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'

const results = runCommands([
  'buddy clean',
  'bun install',
], { cwd: projectPath() })

for (const result of results) {
  if (result.isErr()) {
    log.error(result.error)
    process.exit(ExitCode.FatalError)
  }
}
