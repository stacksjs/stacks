/* eslint-disable no-console */
import process from 'node:process'
import { ExitCode } from 'src/types/src'
import type { CLI, DeployOptions } from 'src/types/src'
import { runAction } from 'src/actions/src'
import { intro, italic, log, outro } from 'src/cli/src'
import { Action } from 'src/enums/src'
import { app } from 'src/config/src'
import { addDomain, hasUserDomainBeenAddedToCloud } from 'src/dns/src'

export function deploy(buddy: CLI) {
  const descriptions = {
    deploy: 'Reinstalls your npm dependencies',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('deploy', descriptions.deploy)
    .option('--domain', 'Specify a domain to deploy to', { default: undefined })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DeployOptions) => {
      const startTime = await intro('buddy deploy')
      const domain = options.domain || app.url

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

      if (domain.includes('localhost')) {
        log.info('You are deploying to a local environment.')
        log.info('Please set your .env or ./config/app.ts properly.')
        console.log('')
        log.info('Alternatively, specify a domain to deploy via the `--domain` flag.')
        console.log('')
        log.info('   ➡️  Example: `buddy deploy --domain example.com`')
        console.log('')
        process.exit(ExitCode.FatalError)
      }

      if (await hasUserDomainBeenAddedToCloud(domain)) {
        log.success('Your domain is properly configured.')
        log.info('Your cloud is deploying...')

        console.log(`⏳ ${italic('This may take a while...')}`)
        await new Promise(resolve => setTimeout(resolve, 2000))
        options.domain = domain
      }

      // if the domain hasn't been added to the user's (AWS) cloud, we will add it for them
      // and then exit the process with prompts for the user to update their nameservers
      else {
        console.log('')
        log.info(`  👋  It appears to be your first ${italic(domain)} deployment.`)
        console.log('')
        log.info(italic('Let’s ensure it is all connected properly.'))
        log.info(italic('One moment...'))
        console.log('')

        options.domain = domain
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

      // now that we know the domain has been added to the users (AWS) cloud, we can deploy
      const result = await runAction(Action.Deploy, options)

      if (result.isErr()) {
        await outro('While running the `buddy deploy`, there was an issue', { startTime, useSeconds: true }, result.error)
        process.exit(ExitCode.FatalError)
      }

      await outro('Deployment succeeded.', { startTime, useSeconds: true })

      process.exit(ExitCode.Success)
    })

  buddy.on('deploy:*', () => {
    log.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
