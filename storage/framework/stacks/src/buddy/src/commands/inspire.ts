import process from 'node:process'
import { ExitCode } from 'src/types/src'
import type { CLI } from 'src/types/src'
import { runAction } from 'src/actions/src'
import { intro, outro } from 'src/cli/src'
import { Action } from 'src/enums/src'

export function inspire(buddy: CLI) {
  buddy
    .command('inspire', 'Inspire yourself with a random quote')
    .option('--two', 'Show two quotes', { default: false })
    .action(async () => {
      const perf = await intro('buddy inspire')
      const result = await runAction(Action.Inspire)

      if (result.isErr()) {
        await outro('While running the inspire command, there was an issue', { startTime: perf, useSeconds: true }, result.error)
        process.exit()
      }

      await outro('Your quote is: ...', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })
}
