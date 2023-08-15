import process from 'node:process'
import { ExitCode } from '@stacksjs/types'
import { runCommands } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'

const results = runCommands([
  'buddy clean',
  'bun install',
], { cwd: projectPath() })

for (const result of results) {
  if (result.isErr()) {
    handleError(result.error)
    process.exit(ExitCode.FatalError)
  }
}
