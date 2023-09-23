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
    .option('--first-name <firstName>', 'Registrant first name', { default: config.dns.contactInfo?.firstName })
    .option('--last-name <lastName>', 'Registrant last name', { default: config.dns.contactInfo?.lastName })
    .option('--organization <organization>', 'Registrant organization name', { default: config.dns.contactInfo?.organizationName })
    .option('--address <address>', 'Registrant address line 1', { default: config.dns.contactInfo?.addressLine1 })
    .option('--address-line-2 <address>', 'Registrant address line 2', { default: config.dns.contactInfo?.addressLine2 })
    .option('--city <city>', 'Registrant city', { default: config.dns.contactInfo?.city })
    .option('--state <state>', 'Registrant state', { default: config.dns.contactInfo?.state })
    .option('--country <country>', 'Registrant country code', { default: config.dns.contactInfo?.countryCode })
    .option('--zip <zip>', 'Registrant zip', { default: config.dns.contactInfo?.zip })
    .option('--phone <phone>', 'Registrant phone', { default: config.dns.contactInfo?.phoneNumber })
    .option('--email <email>', 'Registrant email', { default: config.dns.contactInfo?.email })
    .option('--admin-first-name <firstName>', 'Admin first name', { default: config.dns.contactInfo?.admin?.firstName || config.dns.contactInfo?.firstName })
    .option('--admin-last-name <lastName>', 'Admin last name', { default: config.dns.contactInfo?.admin?.lastName || config.dns.contactInfo?.lastName })
    .option('--admin-organization <organization>', 'Admin organization', { default: config.dns.contactInfo?.admin?.organizationName || config.dns.contactInfo?.organizationName })
    .option('--admin-address <address>', 'Admin address line 1', { default: config.dns.contactInfo?.admin?.addressLine1 || config.dns.contactInfo?.addressLine1 })
    .option('--admin-address-line-2 <address>', 'Admin address line 2', { default: config.dns.contactInfo?.admin?.addressLine2 || config.dns.contactInfo?.addressLine2 })
    .option('--admin-city <city>', 'Admin city', { default: config.dns.contactInfo?.admin?.city || config.dns.contactInfo?.city })
    .option('--admin-state <state>', 'Admin state', { default: config.dns.contactInfo?.admin?.state || config.dns.contactInfo?.state })
    .option('--admin-country <country>', 'Admin country code', { default: config.dns.contactInfo?.admin?.countryCode || config.dns.contactInfo?.countryCode })
    .option('--admin-zip <zip>', 'Admin zip', { default: config.dns.contactInfo?.admin?.zip || config.dns.contactInfo?.zip })
    .option('--admin-phone <phone>', 'Admin phone number', { default: config.dns.contactInfo?.admin?.phoneNumber || config.dns.contactInfo?.phoneNumber })
    .option('--admin-email <email>', 'Admin email', { default: config.dns.contactInfo?.admin?.email || config.dns.contactInfo?.email })
    .option('--tech-first-name <firstName>', 'Tech first name', { default: config.dns.contactInfo?.tech?.firstName || config.dns.contactInfo?.firstName })
    .option('--tech-last-name <lastName>', 'Tech last name', { default: config.dns.contactInfo?.tech?.lastName || config.dns.contactInfo?.lastName })
    .option('--tech-organization <organization>', 'Tech organization name', { default: config.dns.contactInfo?.tech?.organizationName || config.dns.contactInfo?.organizationName })
    .option('--tech-address <address>', 'Tech address line 1', { default: config.dns.contactInfo?.tech?.addressLine1 || config.dns.contactInfo?.addressLine1 })
    .option('--tech-address-line-2 <address>', 'Tech address line 2', { default: config.dns.contactInfo?.tech?.addressLine2 || config.dns.contactInfo?.addressLine2 })
    .option('--tech-city <city>', 'Tech city', { default: config.dns.contactInfo?.tech?.city || config.dns.contactInfo?.city })
    .option('--tech-state <state>', 'Tech state', { default: config.dns.contactInfo?.tech?.state || config.dns.contactInfo?.state })
    .option('--tech-country <country>', 'Tech country', { default: config.dns.contactInfo?.tech?.countryCode || config.dns.contactInfo?.countryCode })
    .option('--tech-zip <zip>', 'Tech zip', { default: config.dns.contactInfo?.tech?.zip || config.dns.contactInfo?.zip })
    .option('--tech-phone <phone>', 'Tech phone', { default: config.dns.contactInfo?.tech?.phoneNumber || config.dns.contactInfo?.phoneNumber })
    .option('--tech-email <email>', 'Tech email', { default: config.dns.contactInfo?.tech?.email || config.dns.contactInfo?.email })
    .option('--privacy-admin', 'Enable privacy protection for admin', { default: config.dns.contactInfo?.privacyAdmin || config.dns.contactInfo?.privacy })
    .option('--privacy-tech', 'Enable privacy protection for tech', { default: config.dns.contactInfo?.privacyTech || config.dns.contactInfo?.privacy })
    .option('--privacy-registrant', 'Enable privacy protection for registrant', { default: config.dns.contactInfo?.privacyRegistrant || config.dns.contactInfo?.privacy })
    .option('--contact-type <type>', 'Contact type', { default: 'person' })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DomainsOptions) => {
      const startTime = await intro('buddy domains:purchase')
      const result = await runAction(Action.DomainsPurchase, options)

      if (result.isErr()) {
        await outro('While running the domains:purchase command, there was an issue', { startTime, useSeconds: true }, result.error)
        process.exit(ExitCode.FatalError)
      }

      // prompt to set the domain the APP_URL
      const domain = options.domain
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { confirm } = await prompts({
        name: 'confirm',
        type: 'confirm',
        message: `Would you like to set ${domain} as your APP_URL?`,
      })

      if (!confirm) {
        await outro(`Great! Your domain ${domain} has been purchased.`, { startTime, useSeconds: true, type: 'info' })
        process.exit(ExitCode.Success)
      }

      let message = `Great! Your domain ${domain} has been purchased.`
      message += `\n\nAnd your APP_URL has been set to ${domain}. This change has not been applied deployed yet. The next time you run buddy deploy, your app will deploy to ${domain}.`

      await outro(message, { startTime, useSeconds: true })
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
