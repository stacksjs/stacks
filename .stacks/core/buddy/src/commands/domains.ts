import process from 'node:process'
import type { CLI, DomainsOptions } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { intro, outro, prompts } from '@stacksjs/cli'
import { Action, ExitCode } from '@stacksjs/types'
import { addDomain } from './deploy'

export function domains(buddy: CLI) {
  const descriptions = {
    add: 'Add a domain to your cloud',
    remove: 'Remove a domain from your cloud',
    skip: 'Skip the confirmation prompt',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('domains:add <domain>', descriptions.add)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DomainsOptions) => {
      const startTime = await intro('buddy domains:add')
      await addDomain(options, startTime)
      process.exit(ExitCode.Success)
    })

  buddy
    .command('domains:remove <domain>', descriptions.remove)
    .option('--yes', descriptions.skip, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DomainsOptions) => {
      const domain = options.domain || config.app.url
      const opts = { ...options, domain }
      const startTime = await intro('buddy domains:remove')

      // prompt for confirmation
      if (!opts.yes) {
        const { confirm } = await prompts({
          name: 'confirm',
          type: 'confirm',
          message: `Are you sure you want to remove ${domain}?`,
        })

        console.log('confirm', confirm)

        if (!confirm) {
          await outro('Cancelled the domains:remove command', { startTime, useSeconds: true, type: 'info' })
          process.exit(ExitCode.Success)
        }
      }

      const result = await runAction(Action.DomainsRemove, opts)

      if (result.isErr()) {
        await outro('While running the domains:remove command, there was an issue', { startTime, useSeconds: true }, result.error)
        process.exit(ExitCode.FatalError)
      }

      await outro('Removed your domain', { startTime, useSeconds: true })
      process.exit(ExitCode.Success)
    })
}
