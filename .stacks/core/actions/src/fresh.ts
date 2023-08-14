import process from 'node:process'
import { ExitCode } from '@stacksjs/types'
import { log, runCommands } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'

const results = runCommands([
  'bun buddy clean',
  'bun install -y',
], { cwd: frameworkPath() })

for (const result of results) {
  if (result.isErr()) {
    log.error(result.error)
    process.exit(ExitCode.FatalError)
  }
}
