import type { CLI, DeployOptions } from '@stacksjs/types'
import { $ } from 'bun'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, italic, log, outro, prompts, runCommand } from '@stacksjs/cli'
import { app } from '@stacksjs/config'
import { addDomain, hasUserDomainBeenAddedToCloud } from '@stacksjs/dns'
import { Action } from '@stacksjs/enums'
import { path as p } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'

export function deploy(buddy: CLI): void {
  const descriptions = {
    deploy: 'Deploy your project',
    project: 'Target a specific project',
    production: 'Deploy to production',
    development: 'Deploy to development',
    staging: 'Deploy to staging',
    yes: 'Confirm all prompts by default',
    domain: 'Specify a domain to deploy to',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('deploy [env]', descriptions.deploy)
    .option('--domain', descriptions.domain, { default: undefined })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--prod', descriptions.production, { default: true })
    .option('--dev', descriptions.development, { default: false })
    .option('--yes', descriptions.yes, { default: false })
    .option('--staging', descriptions.staging, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (env: string | undefined, options: DeployOptions) => {
      log.debug('Running `buddy deploy` ...', options)

      const startTime = await intro('buddy deploy')
      const domain = options.domain || app.url

      if ((options.prod || env === 'production' || env === 'prod') && !options.yes)
        await confirmProductionDeployment()

      if (!domain) {
        log.info('No domain found in your .env or ./config/app.ts')
        log.info('Please ensure your domain is properly configured.')
        log.info('For more info, check out the docs or join our Discord.')
        process.exit(ExitCode.FatalError)
      }

      log.info(`Deploying to ${italic(domain)}`)

      await checkIfAwsIsConfigured()
      await checkIfAwsIsBootstrapped()

      options.domain = await configureDomain(domain, options, startTime)

      const result = await runAction(Action.Deploy, options)

      if (result.isErr()) {
        await outro(
          'While running the `buddy deploy`, there was an issue',
          { startTime, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Project deployed.', { startTime, useSeconds: true })
    })

  buddy.on('deploy:*', () => {
    log.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}

async function confirmProductionDeployment() {
  const { confirmed } = await prompts({
    type: 'confirm',
    name: 'confirmed',
    message: 'Are you sure you want to deploy to production?',
  })

  if (!confirmed) {
    log.info('Aborting deployment...')
    process.exit(ExitCode.InvalidArgument)
  }
}

async function configureDomain(domain: string, options: DeployOptions, startTime: number) {
  log.debug('Configuring domain...', domain)
  if (!domain) {
    log.info('We could not identify a domain to deploy to.')
    log.warn('Please set your .env or ./config/app.ts properly.')
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
    log.warn(
      'Please set your .env or ./config/app.ts properly. The domain we are deploying cannot be a `localhost` domain.',
    )
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
    log.error('AWS is not configured properly.', {
      shouldExit: false,
    })
    log.error('Please run `buddy configure:aws` to set up your AWS credentials.')
  }

  log.success('AWS is configured')
}

async function checkIfAwsIsBootstrapped() {
  try {
    log.info('Ensuring AWS is bootstrapped...')
    // const toolkitName = 'stacks-toolkit'
    await runCommand('aws cloudformation describe-stacks --stack-name stacks-toolkit', { silent: true })
    // await $`aws cloudformation describe-stacks --stack-name stacks-toolkit`.quiet()
    log.success('AWS is bootstrapped')

    return true
  }
  catch (err: any) {
    log.debug(`Not yet bootstrapped. Failed with code ${err.exitCode}`)
    log.debug(err.stdout.toString())
    log.debug(err.stderr.toString())

    log.info('AWS is not bootstrapped yet')
    log.info('Bootstrapping. This may take a few moments...')

    try {
      $.cwd(p.frameworkCloudPath())
      const result = await $`bun run bootstrap`
      console.log(result)
      return true
    }
    catch (error) {
      log.error('Failed to bootstrap AWS')
      console.error(error)
      process.exit(ExitCode.FatalError)
    }
  }
}
