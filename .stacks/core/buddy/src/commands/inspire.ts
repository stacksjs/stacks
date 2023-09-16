import process from 'node:process'
import { type CLI } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'
import { intro, outro } from '@stacksjs/cli'
import { Action, ExitCode } from '@stacksjs/types'

export function inspire(buddy: CLI) {
  buddy
    .command('inspire', 'Inspire yourself with a random quote')
    .option('--two', 'Show two quotes', { default: false })
    .action(async () => {
      const perf = await intro('buddy inspire')
      const result = await runAction(Action.Inspire)

      if (result.isErr()) {
        await outro('While running the inspire command, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
        process.exit()
      }

      await outro('Your quote is: ...', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })
}
