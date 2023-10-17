import process from 'node:process'
import type { CLI, CloudCliOptions } from '@stacksjs/types'
import { intro, italic, log, outro, prompts, runCommand, underline } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { addJumpBox, deleteCdkRemnants, deleteJumpBox, deleteLogGroups, deleteStacksBuckets, deleteStacksFunctions, getJumpBoxInstanceId, isFailedState } from '@stacksjs/cloud'

export function cloud(buddy: CLI) {
  const descriptions = {
    cloud: 'Interact with the Stacks Cloud',
    ssh: 'SSH into the Stacks Cloud',
    add: 'Add a resource to the Stacks Cloud.',
    remove: 'Remove the Stacks Cloud. In case it fails, try again.',
    optimizeCost: 'Optimize the cost of the Stacks Cloud. This removes certain resources that may be re-applied at a later time.',
    cleanUp: 'Cleans up the Stacks Cloud. This removes all resources that were retained during the cloud deletion.',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('cloud', descriptions.cloud)
    .option('--ssh', descriptions.ssh, { default: false })
    .option('--connect', descriptions.ssh, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CloudCliOptions) => {
      if (options.ssh || options.connect) {
        const startTime = performance.now()
        const jumpBoxId = await getJumpBoxInstanceId()
        const result = await runCommand(`aws ssm start-session --target ${jumpBoxId}`, {
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
    .command('cloud:add', descriptions.add)
    .option('--jump-box', 'Remove the jump-box', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CloudCliOptions) => {
      const startTime = await intro('buddy cloud:add')

      if (options.jumpBox) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { confirm } = await prompts({
          name: 'confirm',
          type: 'confirm',
          message: 'Would you like to add a jump-box to your cloud?',
        })

        if (!confirm) {
          await outro('Exited', { startTime, useSeconds: true })
          process.exit(ExitCode.Success)
        }

        log.info('')
        log.info('The jump-box is getting added to your cloud resources...')
        log.info('This takes a few moments, please be patient.')
        log.info('')
        // sleep for 2 seconds to get the user to read the message
        await new Promise(resolve => setTimeout(resolve, 2000))

        const result = await addJumpBox()

        if (result.isErr()) {
          await outro('While running the cloud:add command, there was an issue', { startTime, useSeconds: true }, result.error)
          process.exit(ExitCode.FatalError)
        }

        log.info('')
        log.info(italic('View the jump-box in the AWS console:'))
        log.info(underline('https://us-east-1.console.aws.amazon.com/ec2/home?region=us-east-1#Instances:instanceState=running'))
        log.info('')
        log.info(italic('Once it finished initializing, you may SSH into it:'))
        log.info(underline(('buddy cloud --ssh')))
        log.info('')

        await outro('Your jump-box was added.', { startTime, useSeconds: true })
        process.exit(ExitCode.Success)
      }

      log.info('')
      log.info('This functionality is not yet implemented.')
      process.exit(ExitCode.Success)
    })

  buddy
    .command('cloud:remove', descriptions.remove)
    .alias('cloud:destroy')
    .alias('cloud:rm')
    .alias('undeploy')
    .option('--jump-box', 'Remove the jump-box', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CloudCliOptions) => {
      const startTime = await intro('buddy cloud:remove')

      if (options.jumpBox) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { confirm } = await prompts({
          name: 'confirm',
          type: 'confirm',
          message: 'Would you like to remove your jump-box for now?',
        })

        if (!confirm) {
          await outro('Exited', { startTime, useSeconds: true })
          process.exit(ExitCode.Success)
        }

        const result = await deleteJumpBox()

        if (result.isErr()) {
          await outro('While removing your jump-box, there was an issue', { startTime, useSeconds: true }, result.error)
          process.exit(ExitCode.FatalError)
        }

        await outro('Your jump-box was removed.', { startTime, useSeconds: true })
        process.exit(ExitCode.Success)
      }

      log.info('')
      log.info('ℹ️  Removing your cloud resources will take a while to complete. Please be patient.')
      log.info('')

      // sleep for 2 seconds to get the user to read the message
      await new Promise(resolve => setTimeout(resolve, 2000))

      const result = await runCommand('bunx cdk destroy --profile stacks', {
        ...options,
        cwd: p.cloudPath(),
        stdin: 'inherit',
      })

      if (result.isErr()) {
        await outro('While running the cloud:remove ("undeploy") command, there was an issue', { startTime, useSeconds: true }, result.error)
        process.exit(ExitCode.FatalError)
      }

      await runCommand('buddy cloud:clean-up', {
        ...options,
        cwd: p.projectPath(),
        stdin: 'inherit',
      })

      await outro('Your cloud has successfully been removed', { startTime, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('cloud:optimize-cost', descriptions.optimizeCost)
    .option('--jump-box', 'Remove the jump-box', { default: true })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CloudCliOptions) => {
      const startTime = await intro('buddy cloud:remove')

      if (options.jumpBox) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { confirm } = await prompts({
          name: 'confirm',
          type: 'confirm',
          message: 'Would you like to remove your jump-box to optimize your costs?',
        })

        if (!confirm) {
          await outro('Exited', { startTime, useSeconds: true })
          process.exit(ExitCode.Success)
        }

        await deleteJumpBox()

        await outro('Your jump-box was removed & cost optimizations are applied.', { startTime, useSeconds: true })
        process.exit(ExitCode.Success)
      }

      await outro('No cost optimization was applied', { startTime, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('cloud:clean-up', descriptions.cleanUp)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async () => {
      const startTime = await intro('buddy cloud:clean-up')

      log.info('')
      log.info(`ℹ️  ${italic('Cleaning up your cloud resources will take a while to complete. Please be patient.')}`)
      log.info('')

      // sleep for 2 seconds to get the user to read the message
      await new Promise(resolve => setTimeout(resolve, 2000))

      log.info('Removing any jump-boxes...')
      const result = await deleteJumpBox()

      if (result.isErr()) {
        if (result.error !== 'Jump-box not found') {
          await outro('While removing your jump-box, there was an issue', { startTime, useSeconds: true }, result.error)
          process.exit(ExitCode.FatalError)
        }
      }

      log.info('Removing any retained S3 buckets...')
      const result2 = await deleteStacksBuckets()

      if (result2.isErr()) {
        await outro('While deleting the retained S3 buckets, there was an issue', { startTime, useSeconds: true }, result2.error)
        process.exit(ExitCode.FatalError)
      }

      log.info('Removing any retained Lambda functions...')
      const result3 = await deleteStacksFunctions()

      if (result3.isErr()) {
        if (result3.error !== 'No stacks functions found') {
          await outro('While deleting the Origin Request Lambda function, there was an issue', { startTime, useSeconds: true }, result3.error)
          process.exit(ExitCode.FatalError)
        }
      }

      log.info('Removing any remaining Stacks logs...')
      const result4 = await deleteLogGroups()
      // TODO: investigate other regions for edge (cloudfront) logs

      if (result4.isErr()) {
        await outro('While deleting the Stacks log groups, there was an issue', { startTime, useSeconds: true }, result4.error)
        process.exit(ExitCode.FatalError)
      }

      log.info('Removing any CDK remnants...')
      const result5 = await deleteCdkRemnants()

      if (result5.isErr()) {
        await outro('While deleting the Stacks log groups, there was an issue', { startTime, useSeconds: true }, result5.error)
        process.exit(ExitCode.FatalError)
      }

      log.info('')
      await outro('All AWS resources have been removed', { startTime, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy.on('cloud:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
