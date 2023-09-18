import process from 'node:process'
import type { CLI, DeployOptions } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'
import { intro, italic, outro } from '@stacksjs/cli'
import { Action, ExitCode } from '@stacksjs/types'
import { config } from '@stacksjs/config'
import { Route53 } from '@aws-sdk/client-route-53'

export function deploy(buddy: CLI) {
  const descriptions = {
    deploy: 'Reinstalls your npm dependencies',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('deploy', descriptions.deploy)
    .option('--domain', 'Specify a domain to deploy to', { default: '' })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DeployOptions) => {
      const perf = await intro('buddy deploy')
      const domain = options.domain || config.app.url

      if (await hasUserDomainBeenAddedToCloud(domain)) {
        options.domain = domain
      }

      // if the domain hasn't been added to the user's (AWS) cloud, we will add it for them
      // and then exit the process with prompts for the user to update their nameservers
      else {
        // eslint-disable-next-line no-console
        console.log('')
        // eslint-disable-next-line no-console
        console.log(`ℹ️  It appears to be your first ${domain} deployment.`)
        // eslint-disable-next-line no-console
        console.log('')
        // eslint-disable-next-line no-console
        console.log(italic('Let’s ensure your it is connected properly.'))
        // eslint-disable-next-line no-console
        console.log(italic('One moment...'))
        // eslint-disable-next-line no-console
        console.log('')

        options.domain = domain
        await addDomain(options, perf)
        process.exit(ExitCode.Success)
      }

      // now that we know the domain has been added to the users (AWS) cloud, we can deploy
      const result = await runAction(Action.Deploy, options)

      if (result.isErr()) {
        await outro('While running the `buddy deploy`, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
        process.exit(ExitCode.FatalError)
      }

      await outro('Deployment succeeded.', { startTime: perf, useSeconds: true })

      process.exit(ExitCode.Success)
    })
}

async function hasUserDomainBeenAddedToCloud(domainName?: string) {
  const route53 = new Route53()

  // Check if the hosted zone already exists
  const existingHostedZones = await route53.listHostedZonesByName({ DNSName: domainName })
  if (!existingHostedZones || !existingHostedZones.HostedZones)
    return false

  const existingHostedZone = existingHostedZones.HostedZones.find(zone => zone.Name === `${domainName}.`)
  if (existingHostedZone)
    return true

  return false
}

async function addDomain(options: DeployOptions, startTime: number) {
  const result = await runAction(Action.DomainsAdd, options)

  if (result.isErr()) {
    await outro('While running the `buddy deploy`, there was an issue', { startTime, useSeconds: true, isError: true }, result.error)
    process.exit(ExitCode.FatalError)
  }

  await outro('Added your domain.', { startTime, useSeconds: true })
}
