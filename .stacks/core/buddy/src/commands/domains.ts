import process from 'node:process'
import type { CLI, DomainsOptions } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'
import { intro, outro } from '@stacksjs/cli'
import { Action, ExitCode } from '@stacksjs/types'

export function domains(buddy: CLI) {
  const descriptions = {
    add: 'Add a domain to your project',
    domain: 'The domain to add',
    remove: 'Removes a domain from your project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('domains:add', descriptions.add)
    .option('<domain>', descriptions.domain)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DomainsOptions) => {
      const perf = await intro('buddy domains:add')
      const result = await runAction(Action.DomainsAdd, options)

      if (result.isErr()) {
        await outro('While running the domains:add command, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
        process.exit(ExitCode.FatalError)
      }

      await outro('Added your domain', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('domains:remove', descriptions.remove)
    .option('<domain>', descriptions.domain)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DomainsOptions) => {
      const perf = await intro('buddy domains:remove')
      const result = await runAction(Action.DomainsRemove, options)

      if (result.isErr()) {
        await outro('While running the domains:remove command, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
        process.exit(ExitCode.FatalError)
      }

      await outro('Removed your domain', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })
}
