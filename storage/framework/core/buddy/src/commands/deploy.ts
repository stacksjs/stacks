/* eslint-disable no-console */
import process from 'node:process'
import { ExitCode } from '@stacksjs/types'
import type { CLI, DeployOptions } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'
import { intro, italic, log, outro, runCommand } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { app } from '@stacksjs/config'
import { addDomain, hasUserDomainBeenAddedToCloud } from '@stacksjs/dns'

export function deploy(buddy: CLI) {
  const descriptions = {
    deploy: 'Re-installs your npm dependencies',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('deploy', descriptions.deploy)
    .option('--domain', 'Specify a domain to deploy to', { default: undefined })
    .option('-p, --project', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DeployOptions) => {
      log.debug('Running `buddy deploy` ...', options)

      const startTime = await intro('buddy deploy')
      const domain = options.domain || app.url

      if (!domain) {
        log.info('No domain found in your .env or ./config/app.ts')
        log.info('Please ensure your domain is properly configured.')
        log.info('For more info, check out the docs or join our Discord.')
        process.exit(ExitCode.FatalError)
      }

      await checkIfAwsIsConfigured()

      options.domain = await configureDomain(domain, options, startTime)

      const result = await runAction(Action.Deploy, options)

      if (result.isErr()) {
        await outro('While running the `buddy deploy`, there was an issue', { startTime, useSeconds: true }, result.error)
        process.exit(ExitCode.FatalError)
      }

      await outro('Project deployed.', { startTime, useSeconds: true })
    })

  buddy.on('deploy:*', () => {
    log.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}

async function configureDomain(domain: string, options: DeployOptions, startTime: number) {
  if (!domain) {
    log.info('We could not identify a domain to deploy to.')
    log.info('Please set your .env or ./config/app.ts properly.')
    console.log('')
    log.info('Alternatively, specify a domain to deploy via the `--domain` flag.')
    console.log('')
    log.info('   ➡️  Example: `buddy deploy --domain example.com`')
    console.log('')
    process.exit(ExitCode.FatalError)
  }

  // TODO: we can improve this check at some point, otherwise domains that legitimately include the word localhost will fail
  // TODO: add check for whether the local APP_ENV is getting deployed, if so, ask if the user meant to deploy `dev`
  if (domain.includes('localhost')) {
    log.info('You are deploying to a local environment.')
    log.info('Please set your .env or ./config/app.ts properly. The domain we are deploying cannot be a `localhost` domain.')
    console.log('')
    log.info('Alternatively, specify a domain to deploy via the `--domain` flag.')
    console.log('')
    log.info('   ➡️  Example: `buddy deploy --domain example.com`')
    console.log('')
    process.exit(ExitCode.FatalError)
  }

  if (await hasUserDomainBeenAddedToCloud(domain)) {
    log.info('Domain is properly configured')
    log.info('Your cloud is deploying...')

    log.info(`${italic('This may take a while...')}`)

    return domain
  }

  // if the domain hasn't been added to the user's (AWS) cloud, we will add it for them
  // and then exit the process with prompts for the user to update their nameservers
  console.log('')
  log.info(`  👋  It appears to be your first ${italic(domain)} deployment.`)
  console.log('')
  log.info(italic('Let’s ensure it is all connected properly.'))
  log.info(italic('One moment...'))
  console.log('')

  const result = await addDomain({
    ...options,
    deploy: true,
    startTime,
  })

  if (result.isErr()) {
    await outro('While running the `buddy deploy`, there was an issue', { startTime, useSeconds: true }, result.error)
    process.exit(ExitCode.FatalError)
  }

  await outro('Added your domain.', { startTime, useSeconds: true })
  process.exit(ExitCode.Success)
}

async function checkIfAwsIsConfigured() {
  log.info('Ensuring AWS is configured...')
  const result = await runCommand('buddy configure:aws', {
    silent: true,
  })

  if (result.isErr()) {
    log.error('AWS is not configured properly.')
    log.error('Please run `buddy configure:aws` to set up your AWS credentials.')
    process.exit(ExitCode.FatalError)
  }

  log.success('AWS is configured')
}
