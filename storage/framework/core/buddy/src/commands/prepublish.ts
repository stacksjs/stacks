import type { CLI, PrepublishOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { Action } from '@stacksjs/enums'
import { log } from '@stacksjs/logging'
import { ExitCode } from '@stacksjs/types'
import { onUnknownSubcommand } from "@stacksjs/cli"
import { resultFailed } from '../result'

export function prepublish(buddy: CLI): void {
  const descriptions = {
    command: 'Run your prepublish script',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('prepublish', descriptions.command)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: PrepublishOptions) => {
      log.debug('Running `buddy prepublish` ...', options)

      // The Result used to be dropped, so a prepublish that built nothing
      // exited 0 and `buddy prepublish && npm publish` published anyway
      // (stacksjs/stacks#3158).
      const result = await runAction(Action.Prepublish, options)
      if (resultFailed(result)) {
        await log.error('Prepublish failed, so nothing should be published.', result.error)
        await log.flush()
        process.exit(ExitCode.FatalError)
      }
    })

  onUnknownSubcommand(buddy, "prepublish")
}
