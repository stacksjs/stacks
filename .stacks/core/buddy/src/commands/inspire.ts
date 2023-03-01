import type { CLI } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'
import { intro, outro } from '@stacksjs/cli'
import { Action, ExitCode } from '@stacksjs/types'

async function inspire(buddy: CLI) {
  buddy
    .command('inspire', 'Inspire yourself with a random quote')
    .option('--two', 'Show two quotes', { default: false })
    .action(async () => {
      const perf = await intro('buddy inspire')
      const result = await runAction(Action.Inspire)

      if (result.isErr()) {
        outro('While running the inspire command, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
        process.exit()
      }

      outro('Your quote is: ...', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })
}

export { inspire }
