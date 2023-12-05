import process from 'node:process'
import type { CLI, FreshOptions } from 'stacks:types'
import { ExitCode } from 'stacks:types'
import { runAction } from 'stacks:actions'
import { intro, outro } from 'stacks:cli'
import { Action } from 'stacks:enums'

export function changelog(buddy: CLI) {
  const descriptions = {
    changelog: 'Create a CHANGELOG.md file',
    quiet: 'Minimal output',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('changelog', descriptions.changelog)
    .option('--quiet', descriptions.quiet, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: FreshOptions) => {
      const perf = await intro('buddy changelog')
      const result = await runAction(Action.Changelog, options)

      if (result.isErr()) {
        await outro('While running the changelog command, there was an issue', { ...options, startTime: perf, useSeconds: true }, result.error)
        process.exit()
      }

      await outro('Generated the CHANGELOG.md file', { ...options, startTime: perf, useSeconds: true, type: 'info' })
      process.exit(ExitCode.Success)
    })

  buddy.on('changelog:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
