import process from 'node:process'
import type { CLI, CloudOptions } from '@stacksjs/types'
import { intro, italic, log, outro, runCommand } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'

export function cloud(buddy: CLI) {
  const descriptions = {
    cloud: 'Interact with the Stacks Cloud',
    ssh: 'SSH into the Stacks Cloud',
    remove: 'Remove the Stacks Cloud. In case it fails, try again.',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('cloud', descriptions.cloud)
    .option('--ssh', descriptions.ssh, { default: false })
    .option('--connect', descriptions.ssh, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CloudOptions) => {
      if (options.ssh || options.connect) {
        const startTime = performance.now()
        const result = await runCommand('aws ssm start-session --target i-0a4a48be7544a72e3', {
          ...options,
          cwd: p.projectPath(),
          stdin: 'pipe',
        })

        if (result.isErr()) {
          await outro('While running the cloud command, there was an issue', { startTime, useSeconds: true }, result.error)
          process.exit(ExitCode.FatalError)
        }

        await outro('Exited', { startTime, useSeconds: true })
        process.exit(ExitCode.Success)
      }

      log.info('Not implemented yet. Please use the --ssh (or --connect) flag to connect to the Stacks Cloud.')
      process.exit(ExitCode.Success)
    })

  buddy
    .command('cloud:remove', descriptions.remove)
    .alias('cloud:destroy')
    // .option('--jump-box', 'Remove the jump box', { default: true })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CloudOptions) => {
      const startTime = await intro('buddy cloud:remove')

      log.info('')
      log.info('Please note, removing your cloud resources will take a while to complete. Please be patient.')
      log.info('')
      log.info(italic('If you see an error, please try again. If the error persists, please contact support.'))
      // sleep for 2 seconds to get the user to read the message
      await new Promise(resolve => setTimeout(resolve, 2000))

      const result = await runCommand('bunx cdk destroy --profile stacks', {
        ...options,
        cwd: p.cloudPath(),
        stdin: 'inherit',
      })

      if (result.isErr()) {
        await outro('While running the cloud:remove command, there was an issue', { startTime, useSeconds: true }, result.error)
        process.exit(ExitCode.FatalError)
      }

      await outro('Exited', { startTime, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy.on('cloud:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
