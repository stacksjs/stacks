import process from 'node:process'
import { ExitCode } from 'stacks:types'
import type { CLI, TinkerOptions } from 'stacks:types'
import { runAction } from 'stacks:actions'
import { intro, outro } from 'stacks:cli'
import { Action } from 'stacks:enums'

export function tinker(buddy: CLI) {
  const descriptions = {
    tinker: 'Tinker with your code',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('tinker', descriptions.tinker)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: TinkerOptions) => {
      const perf = await intro('buddy tinker')
      const result = await runAction(Action.Tinker, options)

      if (result.isErr()) {
        await outro('While running the tinker command, there was an issue', { startTime: perf, useSeconds: true }, result.error || undefined)
        process.exit()
      }

      await outro('Tinker mode exited.', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy.on('tinker:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
