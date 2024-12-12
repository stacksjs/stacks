import type { CLI, DomainsOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { bgCyan, bold, intro, italic, log, outro, prompts } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { addDomain } from '@stacksjs/dns'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'

export function domains(buddy: CLI): void {
  const descriptions = {
    purchase: 'Purchase a domain',
    add: 'Add a domain to your cloud', // given you already own it with a different registrar
    remove: 'Remove a domain from your cloud',
    skip: 'Skip the confirmation prompt',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  const c = config.dns.contactInfo

  buddy
    .command('domains:purchase <domain>', descriptions.purchase)
    .option('--years <years>', 'Number of years to purchase the domain for', {
      default: 1,
    })
    .option('--privacy', 'Enable privacy protection', { default: true })
    .option('--auto-renew', 'Enable auto-renew', { default: true })
    .option('--first-name <firstName>', 'Registrant first name', {
      default: c?.firstName,
    })
    .option('--last-name <lastName>', 'Registrant last name', {
      default: c?.lastName,
    })
    .option('--organization <organization>', 'Registrant organization name', {
      default: c?.organizationName,
    })
    .option('--address-line1 <address>', 'Registrant address line 1', {
      default: c?.addressLine1,
    })
    .option('--address-line2 <address>', 'Registrant address line 2', {
      default: c?.addressLine2,
    })
    .option('--city <city>', 'Registrant city', { default: c?.city })
    .option('--state <state>', 'Registrant state', { default: c?.state })
    .option('--country <country>', 'Registrant country code', {
      default: c?.countryCode,
    })
    .option('--zip <zip>', 'Registrant zip', { default: c?.zip })
    .option('--phone <phone>', 'Registrant phone', { default: c?.phoneNumber })
    .option('--email <email>', 'Registrant email', { default: c?.email })
    .option('--admin-first-name <firstName>', 'Admin first name', {
      default: c?.admin?.firstName || c?.firstName,
    })
    .option('--admin-last-name <lastName>', 'Admin last name', {
      default: c?.admin?.lastName || c?.lastName,
    })
    .option('--admin-organization <organization>', 'Admin organization', {
      default: c?.admin?.organizationName || c?.organizationName,
    })
    .option('--admin-address-line1 <address>', 'Admin address line 1', {
      default: c?.admin?.addressLine1 || c?.addressLine1,
    })
    .option('--admin-address-line2 <address>', 'Admin address line 2', {
      default: c?.admin?.addressLine2 || c?.addressLine2,
    })
    .option('--admin-city <city>', 'Admin city', {
      default: c?.admin?.city || c?.city,
    })
    .option('--admin-state <state>', 'Admin state', {
      default: c?.admin?.state || c?.state,
    })
    .option('--admin-country <country>', 'Admin country code', {
      default: c?.admin?.countryCode || c?.countryCode,
    })
    .option('--admin-zip <zip>', 'Admin zip', {
      default: c?.admin?.zip || c?.zip,
    })
    .option('--admin-phone <phone>', 'Admin phone number', {
      default: c?.admin?.phoneNumber || c?.phoneNumber,
    })
    .option('--admin-email <email>', 'Admin email', {
      default: c?.admin?.email || c?.email,
    })
    .option('--tech-first-name <firstName>', 'Tech first name', {
      default: c?.tech?.firstName || c?.firstName,
    })
    .option('--tech-last-name <lastName>', 'Tech last name', {
      default: c?.tech?.lastName || c?.lastName,
    })
    .option('--tech-organization <organization>', 'Tech organization name', {
      default: c?.tech?.organizationName || c?.organizationName,
    })
    .option('--tech-address-line1 <address>', 'Tech address line 1', {
      default: c?.tech?.addressLine1 || c?.addressLine1,
    })
    .option('--tech-address-line2 <address>', 'Tech address line 2', {
      default: c?.tech?.addressLine2 || c?.addressLine2,
    })
    .option('--tech-city <city>', 'Tech city', {
      default: c?.tech?.city || c?.city,
    })
    .option('--tech-state <state>', 'Tech state', {
      default: c?.tech?.state || c?.state,
    })
    .option('--tech-country <country>', 'Tech country', {
      default: c?.tech?.countryCode || c?.countryCode,
    })
    .option('--tech-zip <zip>', 'Tech zip', { default: c?.tech?.zip || c?.zip })
    .option('--tech-phone <phone>', 'Tech phone', {
      default: c?.tech?.phoneNumber || c?.phoneNumber,
    })
    .option('--tech-email <email>', 'Tech email', {
      default: c?.tech?.email || c?.email,
    })
    .option('--privacy-admin', 'Enable privacy protection for admin', {
      default: c?.privacyAdmin || c?.privacy || true,
    })
    .option('--privacy-tech', 'Enable privacy protection for tech', {
      default: c?.privacyTech || c?.privacy || true,
    })
    .option('--privacy-registrant', 'Enable privacy protection for registrant', {
      default: c?.privacyRegistrant || c?.privacy || true,
    })
    .option('--contact-type <type>', 'Contact type', { default: 'person' })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (domain: string, options: DomainsOptions) => {
      log.debug('Running `buddy domains:purchase <domain>` ...', options)

      options.domain = domain
      const startTime = await intro('buddy domains:purchase')
      const result = await runAction(Action.DomainsPurchase, options)

      if (result.isErr()) {
        await outro(
          'While running the domains:purchase command, there was an issue',
          { startTime, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      const { confirm } = await prompts({
        name: 'confirm',
        type: 'confirm',
        message: `Would you like to set ${domain} as your APP_URL?`,
      })

      if (!confirm) {
        await outro(`Alrighty! ${italic(domain)} was added to your account.`, {
          startTime,
          useSeconds: true,
          type: 'success',
        })
        log.info(
          `Please note, you may need to validate your email address. Check your ${italic(
            options.registrantEmail as string,
          )} inbox.`,
        )
        process.exit(ExitCode.Success)
      }

      // set .env APP_URL to domain
      const { writeEnv } = await import('@stacksjs/env')
      writeEnv('APP_URL', domain)

      let message = `Great! ${italic(domain)} was added to your account.`
      message += `\n\nAnd your APP_URL has been set to ${italic(domain)}.
      \nPlease note, this change has not been deployed yet.
      \nThe next time you run ${bgCyan(italic(bold(' buddy deploy ')))}, your app will deploy to ${italic(domain)}.
      \n${italic(
        'You may need to deploy 2-3 times for the changes to take effect. Issue tracked here: https://github.com/stacksjs/stacks/issues/685',
      )}`

      await outro(message, { startTime, useSeconds: true, type: 'info' })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('domains:add <domain>', descriptions.add)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DomainsOptions) => {
      log.debug('Running `buddy domains:add <domain>` ...', options)

      const startTime = await intro('buddy domains:add')
      const result = await addDomain({
        ...options,
        startTime,
      })

      if (result.isErr()) {
        await outro(
          'While running the `buddy deploy`, there was an issue',
          { startTime, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Added your domain.', { startTime, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('domains:remove <domain>', descriptions.remove)
    .option('--yes', descriptions.skip, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DomainsOptions) => {
      log.debug('Running `buddy domains:remove <domain>` ...', options)

      const domain = options.domain || config.app.url
      const opts = { ...options, domain }
      const startTime = await intro('buddy domains:remove')

      if (!opts.yes) {
        const { confirm } = await prompts({
          name: 'confirm',
          type: 'confirm',
          message: `Are you sure you want to remove ${domain}?`,
        })

        if (!confirm) {
          await outro('Cancelled the domains:remove command', {
            startTime,
            useSeconds: true,
            type: 'info',
          })
          process.exit(ExitCode.Success)
        }
      }

      const result = await runAction(Action.DomainsRemove, opts)

      if (result.isErr()) {
        await outro(
          'While running the domains:remove command, there was an issue',
          { startTime, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Removed your domain DNS records.', {
        startTime,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  buddy.on('domains:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
