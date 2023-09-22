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
    .option('--admin-first-name <firstName>', 'Admin first name', { default: 'John' })
    .option('--admin-last-name <lastName>', 'Admin last name', { default: 'Doe' })
    .option('--admin-organization <organization>', 'Admin organization', { default: 'Example Inc.' })
    .option('--admin-address <address>', 'Admin address', { default: '555 Any Street' })
    .option('--admin-city <city>', 'Admin city', { default: 'Any City' })
    .option('--admin-state <state>', 'Admin state', { default: 'NY' })
    .option('--admin-country <country>', 'Admin country', { default: 'US' })
    .option('--admin-zip <zip>', 'Admin zip', { default: '11111' })
    .option('--admin-phone <phone>', 'Admin phone', { default: '+11111111111' })
    .option('--admin-email <email>', 'Admin email', { default: '' })
    .option('--tech-first-name <firstName>', 'Tech first name', { default: 'John' })
    .option('--tech-last-name <lastName>', 'Tech last name', { default: 'Doe' })
    .option('--tech-organization <organization>', 'Tech organization', { default: 'Example Inc.' })
    .option('--tech-address <address>', 'Tech address', { default: '555 Any Street' })
    .option('--tech-city <city>', 'Tech city', { default: 'Any City' })
    .option('--tech-state <state>', 'Tech state', { default: 'NY' })
    .option('--tech-country <country>', 'Tech country', { default: 'US' })
    .option('--tech-zip <zip>', 'Tech zip', { default: '11111' })
    .option('--tech-phone <phone>', 'Tech phone', { default: '+11111111111' })
    .option('--tech-email <email>', 'Tech email', { default: '' })
    .option('--registrant-first-name <firstName>', 'Registrant first name', { default: 'John' })
    .option('--registrant-last-name <lastName>', 'Registrant last name', { default: 'Doe' })
    .option('--registrant-organization <organization>', 'Registrant organization', { default: 'Example Inc.' })
    .option('--registrant-address <address>', 'Registrant address', { default: '555 Any Street' })
    .option('--registrant-city <city>', 'Registrant city', { default: 'Any City' })
    .option('--registrant-state <state>', 'Registrant state', { default: 'NY' })
    .option('--registrant-country <country>', 'Registrant country', { default: 'US' })
    .option('--registrant-zip <zip>', 'Registrant zip', { default: '11111' })
    .option('--registrant-phone <phone>', 'Registrant phone', { default: '+11111111111' })
    .option('--registrant-email <email>', 'Registrant email', { default: '' })
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
