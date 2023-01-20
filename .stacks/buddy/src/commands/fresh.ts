import type { CLI, FreshOptions } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'
import { intro, outro } from '@stacksjs/cli'
import { Action, ExitCode } from '@stacksjs/types'

async function fresh(buddy: CLI) {
  const descriptions = {
    fresh: 'Reinstalls your npm dependencies',
    debug: 'Enable debug mode',
  }

  buddy
    .command('fresh', descriptions.fresh)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: FreshOptions) => {
      const perf = await intro('buddy fresh')
      const result = await runAction(Action.Fresh, { ...options, showSpinner: true, spinnerText: 'Freshly installing dependencies...' })

      if (result.isErr()) {
        outro('While running the fresh command, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
        process.exit()
      }

      outro('Freshly reinstalled your dependencies.', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })
}

export { fresh }
