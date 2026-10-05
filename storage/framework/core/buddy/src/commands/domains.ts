import type { CLI, DomainsOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { bgCyan, bold, intro, italic, log, onUnknownSubcommand, outro, prompts } from "@stacksjs/cli"
import { awaitConfig } from '@stacksjs/config'
import { addDomain } from '@stacksjs/dns'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'
import { resultFailed } from '../result'

export function domains(buddy: CLI): void {
  const descriptions = {
    purchase: 'Purchase a domain',
    add: 'Add a domain to your cloud', // given you already own it with a different registrar
    remove: 'Remove a domain from your cloud',
    skip: 'Skip the confirmation prompt',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  // No defaults from config/dns.ts here. They were read when the command was
  // registered, before the app's config loads, so they were the framework's
  // empty defaults - and `privacy` was `value || fallback || true`, which is
  // always true. Passed on as flags, they then overrode what the action reads
  // from config itself. The action owns the defaults; a flag given here
  // overrides one field.
  buddy
    .command('domains:purchase <domain>', descriptions.purchase)
    .option('--years <years>', 'Number of years to purchase the domain for')
    // `--no-privacy` and `--no-auto-renew` work without being declared: the
    // parser reads them as `false` for the declared option. Declaring them
    // would give both a default of `true`, which overrides the config again.
    .option('--privacy', 'Enable privacy protection; --no-privacy disables it (default: contactInfo.privacy, else on)')
    .option('--auto-renew', 'Enable auto-renew; --no-auto-renew disables it (default: on)')
    .option('--first-name <firstName>', 'Registrant first name')
    .option('--last-name <lastName>', 'Registrant last name')
    .option('--organization <organization>', 'Registrant organization name')
    .option('--address-line1 <address>', 'Registrant address line 1')
    .option('--address-line2 <address>', 'Registrant address line 2')
    .option('--city <city>', 'Registrant city')
    .option('--state <state>', 'Registrant state')
    .option('--country <country>', 'Registrant country code')
    .option('--zip <zip>', 'Registrant zip')
    .option('--phone <phone>', 'Registrant phone')
    .option('--email <email>', 'Registrant email')
    .option('--admin-first-name <firstName>', 'Admin first name')
    .option('--admin-last-name <lastName>', 'Admin last name')
    .option('--admin-organization <organization>', 'Admin organization')
    .option('--admin-address-line1 <address>', 'Admin address line 1')
    .option('--admin-address-line2 <address>', 'Admin address line 2')
    .option('--admin-city <city>', 'Admin city')
    .option('--admin-state <state>', 'Admin state')
    .option('--admin-country <country>', 'Admin country code')
    .option('--admin-zip <zip>', 'Admin zip')
    .option('--admin-phone <phone>', 'Admin phone number')
    .option('--admin-email <email>', 'Admin email')
    .option('--tech-first-name <firstName>', 'Tech first name')
    .option('--tech-last-name <lastName>', 'Tech last name')
    .option('--tech-organization <organization>', 'Tech organization name')
    .option('--tech-address-line1 <address>', 'Tech address line 1')
    .option('--tech-address-line2 <address>', 'Tech address line 2')
    .option('--tech-city <city>', 'Tech city')
    .option('--tech-state <state>', 'Tech state')
    .option('--tech-country <country>', 'Tech country')
    .option('--tech-zip <zip>', 'Tech zip')
    .option('--tech-phone <phone>', 'Tech phone')
    .option('--tech-email <email>', 'Tech email')
    .option('--contact-type <type>', 'Contact type (default: contactInfo.contactType, else person)')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (domain: string, options: DomainsOptions) => {
      log.debug('Running `buddy domains:purchase <domain>` ...', options)

      options.domain = domain
      // `false` is dropped on the way to an action (see buddyOptionArgs), so
      // `--no-privacy` is sent as the string the action's parser reads back
      // as false.
      const forwarded: Record<string, unknown> = { ...options }
      for (const key of ['privacy', 'autoRenew'] as const) {
        if (forwarded[key] === false)
          forwarded[key] = 'false'
      }
      const startTime = await intro('buddy domains:purchase')
      const result = await runAction(Action.DomainsPurchase, forwarded as DomainsOptions)

      if (resultFailed(result)) {
        await outro(
          'While running the domains:purchase command, there was an issue',
          { startTime, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      // `prompts` is an object of prompt functions, not the callable the npm
      // package of that name exports - calling it threw "prompts is not a
      // function" at every one of these interactive paths. Behind
      // `(prompts)(...)`, nothing said so.
      const confirm = await prompts.confirm(`Would you like to set ${domain} as your APP_URL?`)

      if (!confirm) {
        await outro(`Alrighty! ${italic(domain)} was added to your account.`, {
          startTime,
          useSeconds: true,
          type: 'success',
        })
        const { dns } = await awaitConfig()
        const email = (options as Record<string, unknown>).email as string | undefined || dns?.contactInfo?.email
        log.info(
          `Please note, you may need to validate your email address. Check your ${italic(
            email ?? 'registrant',
          )} inbox.`,
        )
        await log.flush()
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
    // cac passes the positional first. Taking only `options`, this received the
    // domain string, spread its characters into the options, and `addDomain`
    // never saw a domain at all.
    .action(async (domain: string, options: DomainsOptions) => {
      log.debug('Running `buddy domains:add <domain>` ...', options)

      const startTime = await intro('buddy domains:add')
      const result = await addDomain({
        ...options,
        domain,
        startTime,
      })

      if (resultFailed(result)) {
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
    // The positional first, as cac passes it. Taking only `options`, this
    // received the domain string, found no `.domain` on it, and fell back to
    // `config.app.url`: `buddy domains:remove other.com` deleted the DNS
    // records of the app's own domain.
    .action(async (domain: string, options: DomainsOptions) => {
      log.debug('Running `buddy domains:remove <domain>` ...', options)

      const opts = { ...options, domain }
      const startTime = await intro('buddy domains:remove')

      if (!opts.yes) {
        // `prompts` is an object of prompt functions, not the callable the npm
        // package of that name exports - calling it threw "prompts is not a
        // function" at every one of these interactive paths. Behind
        // `(prompts)(...)`, nothing said so.
        const confirm = await prompts.confirm(`Are you sure you want to remove ${domain}?`)

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

      if (resultFailed(result)) {
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

  onUnknownSubcommand(buddy, "domains")
}
