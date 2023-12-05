import process from 'node:process'
import { ExitCode } from 'stacks:types'
import type { CLI } from 'stacks:types'
import { runAction } from 'stacks:actions'
import { intro, outro } from 'stacks:cli'
import { Action } from 'stacks:enums'

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
