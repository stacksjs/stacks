import process from 'node:process'
import type { CLI, DomainsOptions } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { intro, outro, prompts } from '@stacksjs/cli'
import { Action, ExitCode } from '@stacksjs/types'
import { addDomain } from './deploy'

export function domains(buddy: CLI) {
  const descriptions = {
    purchase: 'Purchase a domain',
    add: 'Add a domain to your cloud', // given you already own it with a different registrar
    remove: 'Remove a domain from your cloud',
    skip: 'Skip the confirmation prompt',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('domains:purchase <domain>', descriptions.purchase)
    .option('--years <years>', 'Number of years to purchase the domain for', { default: 1 })
    .option('--privacy', 'Enable privacy protection', { default: true })
    .option('--auto-renew', 'Enable auto-renew', { default: true })
    .option('--admin-first-name <firstName>', 'Admin first name')
    .option('--admin-last-name <lastName>', 'Admin last name')
    .option('--admin-organization <organization>', 'Admin organization')
    .option('--admin-address <address>', 'Admin address')
    .option('--admin-city <city>', 'Admin city')
    .option('--admin-state <state>', 'Admin state')
    .option('--admin-country <country>', 'Admin country')
    .option('--admin-zip <zip>', 'Admin zip')
    .option('--admin-phone <phone>', 'Admin phone')
    .option('--admin-email <email>', 'Admin email')
    .option('--tech-first-name <firstName>', 'Tech first name')
    .option('--tech-last-name <lastName>', 'Tech last name')
    .option('--tech-organization <organization>', 'Tech organization')
    .option('--tech-address <address>', 'Tech address')
    .option('--tech-city <city>', 'Tech city')
    .option('--tech-state <state>', 'Tech state')
    .option('--tech-country <country>', 'Tech country')
    .option('--tech-zip <zip>', 'Tech zip')
    .option('--tech-phone <phone>', 'Tech phone')
    .option('--tech-email <email>', 'Tech email')
    .option('--registrant-first-name <firstName>', 'Registrant first name')
    .option('--registrant-last-name <lastName>', 'Registrant last name')
    .option('--registrant-organization <organization>', 'Registrant organization')
    .option('--registrant-address <address>', 'Registrant address')
    .option('--registrant-city <city>', 'Registrant city')
    .option('--registrant-state <state>', 'Registrant state')
    .option('--registrant-country <country>', 'Registrant country')
    .option('--registrant-zip <zip>', 'Registrant zip')
    .option('--registrant-phone <phone>', 'Registrant phone')
    .option('--registrant-email <email>', 'Registrant email')
    .option('--privacy-admin', 'Enable privacy protection for admin', { default: true })
    .option('--privacy-tech', 'Enable privacy protection for tech', { default: true })
    .option('--privacy-registrant', 'Enable privacy protection for registrant', { default: true })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DomainsOptions) => {
      const startTime = await intro('buddy domains:purchase')
      const result = await runAction(Action.DomainsPurchase, options)

      if (result.isErr()) {
        await outro('While running the domains:purchase command, there was an issue', { startTime, useSeconds: true }, result.error)
        process.exit(ExitCode.FatalError)
      }

      await outro('Purchased your domain.', { startTime, useSeconds: true })
      process.exit(ExitCode.Success)
    })

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

      if (!opts.yes) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { confirm } = await prompts({
          name: 'confirm',
          type: 'confirm',
          message: `Are you sure you want to remove ${domain}?`,
        })

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

      await outro('Removed your domain.', { startTime, useSeconds: true })
      process.exit(ExitCode.Success)
    })
}
