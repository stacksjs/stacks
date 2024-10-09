import type { CLI, CloudCliOptions } from '@stacksjs/types'
import process from 'node:process'
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront'
import { intro, italic, log, outro, prompts, runCommand, underline } from '@stacksjs/cli'
import {
  addJumpBox,
  deleteCdkRemnants,
  deleteIamUsers,
  deleteJumpBox,
  deleteLogGroups,
  deleteParameterStore,
  deleteStacksBuckets,
  deleteStacksFunctions,
  deleteSubnets,
  deleteVpcs,
  getCloudFrontDistributionId,
  getJumpBoxInstanceId,
} from '@stacksjs/cloud'
import { path as p } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { loop } from '@stacksjs/utils'

export function cloud(buddy: CLI): void {
  const descriptions = {
    cloud: 'Interact with the Stacks Cloud',
    ssh: 'SSH into the Stacks Cloud',
    add: 'Add a resource to the Stacks Cloud',
    remove: 'Remove the Stacks Cloud. In case it fails, try again',
    optimizeCost: 'Remove certain resources that may be re-applied at a later time',
    cleanUp: 'Remove all resources that were retained during the cloud deletion',
    invalidateCache: 'Invalidate the CloudFront cache',
    diff: 'Show the diff of the current, undeployed cloud changes ',
    paths: 'The paths to invalidate',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('cloud', descriptions.cloud)
    .option('--ssh', descriptions.ssh, { default: false })
    .option('--connect', descriptions.ssh, { default: false })
    .option('--invalidate-cache', descriptions.invalidateCache, { default: false })
    .option('--paths [paths]', descriptions.paths)
    .option('--diff', descriptions.diff, { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CloudCliOptions) => {
      log.debug('Running `buddy cloud` ...', options)
      const startTime = performance.now()

      if (options.ssh || options.connect) {
        const jumpBoxId = await getJumpBoxInstanceId()
        const result = await runCommand(`aws ssm start-session --target ${jumpBoxId}`, {
          ...options,
          cwd: p.projectPath(),
          stdin: 'pipe',
        })

        if (result.isErr()) {
          await outro(
            'While running the cloud command, there was an issue',
            { startTime, useSeconds: true },
            result.error,
          )
          process.exit(ExitCode.FatalError)
        }

        await outro('Exited', { startTime, useSeconds: true })
        process.exit(ExitCode.Success)
      }

      if (options.invalidateCache) {
        const { confirm } = await prompts({
          name: 'confirm',
          type: 'confirm',
          message: 'Would you like to invalidate the CDN (CloudFront) cache?',
        })

        if (!confirm) {
          await outro('Exited', { startTime, useSeconds: true })
          process.exit(ExitCode.Success)
        }

        log.info('Invalidating the CloudFront cache...')

        const cloudfront = new CloudFrontClient()
        const distributionId = await getCloudFrontDistributionId()

        const params = {
          DistributionId: distributionId,
          InvalidationBatch: {
            CallerReference: `${Date.now()}`,
            Paths: {
              Quantity: 1,
              Items: [
                '/*',
                /* more items */
              ],
            },
          },
        }

        const command = new CreateInvalidationCommand(params)

        cloudfront.send(command).then(
          data => console.log(data),
          err => console.log(err, err.stack),
        )

        await outro('Exited', { startTime, useSeconds: true })
        process.exit(ExitCode.Success)
      }

      if (options.diff) {
        const result = await runCommand('bunx --bun cdk diff', {
          cwd: p.frameworkCloudPath(),
          stdin: 'pipe',
        })

        if (result.isErr()) {
          await outro(
            'While running the cloud diff command, there was an issue',
            { startTime, useSeconds: true },
            result.error,
          )
          process.exit(ExitCode.FatalError)
        }

        await outro('Showing diff of the current, undeployed cloud changes', { startTime, useSeconds: true })
        console.log(result.value)
        process.exit(ExitCode.Success)
      }

      log.info('Not implemented yet. Read more about `buddy cloud` here: https://stacksjs.org/docs/cloud')
      process.exit(ExitCode.Success)
    })

  buddy
    .command('cloud:add', descriptions.add)
    .option('--jump-box', 'Remove the jump-box', { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CloudCliOptions) => {
      log.debug('Running `buddy cloud:add` ...', options)

      const startTime = await intro('buddy cloud:add')

      if (options.jumpBox) {
        const { confirm } = await prompts({
          name: 'confirm',
          type: 'confirm',
          message: 'Would you like to add a jump-box to your cloud?',
        })

        if (!confirm) {
          await outro('Exited', { startTime, useSeconds: true })
          process.exit(ExitCode.Success)
        }

        log.info('The jump-box is getting added to your cloud resources...')
        log.info('This takes a few moments, please be patient.')
        // sleep for 2 seconds to get the user to read the message
        await new Promise(resolve => setTimeout(resolve, 2000))

        const result = await addJumpBox()

        if (result.isErr()) {
          await outro(
            'While running the cloud:add command, there was an issue',
            { startTime, useSeconds: true },
            result.error,
          )
          process.exit(ExitCode.FatalError)
        }

        log.info(italic('View the jump-box in the AWS console:'))
        log.info(
          underline(
            'https://us-east-1.console.aws.amazon.com/ec2/home?region=us-east-1#Instances:instanceState=running',
          ),
        )
        log.info(italic('Once it finished initializing, you may SSH into it:'))
        log.info(underline('buddy cloud --ssh'))

        await outro('Your jump-box was added.', {
          startTime,
          useSeconds: true,
        })
        process.exit(ExitCode.Success)
      }

      log.info('This functionality is not yet implemented.')
      process.exit(ExitCode.Success)
    })

  buddy
    .command('cloud:remove', descriptions.remove)
    .alias('cloud:destroy')
    .alias('cloud:rm')
    .alias('undeploy')
    .option('--jump-box', 'Remove the jump-box', { default: false })
    // .option('--realtime-cdn-logs', 'Remove the CDN Realtime Log Stream', { default: false }) // TODO: implement this
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CloudCliOptions) => {
      log.debug('Running `buddy cloud:remove` ...', options)

      const startTime = await intro('buddy cloud:remove')

      if (options.jumpBox) {
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

        await outro('Your jump-box was removed.', {
          startTime,
          useSeconds: true,
        })
        process.exit(ExitCode.Success)
      }

      console.log(`   ${italic('ℹ️   Removing your cloud resources takes a while to complete.')}`)
      console.log(`   ${italic('Please note, your backups will not yet be deleted. Though,')}`)
      console.log(`   ${italic('Backups are scheduled to delete themselves in 30 days.')}`)

      // sleep for 2 seconds to get the user to read the message
      await new Promise(resolve => setTimeout(resolve, 2000))

      const result = await runCommand(`bunx --bun cdk destroy`, {
        ...options,
        cwd: p.frameworkCloudPath(),
        stdin: 'inherit',
      })

      if (result.isErr()) {
        await outro(
          'While running the cloud:remove ("undeploy") command, there was an issue',
          { startTime, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await runCommand('buddy cloud:cleanup', {
        ...options,
        cwd: p.projectPath(),
        stdin: 'inherit',
      })

      // TODO: this should not be necessary but for some reason some buckets with versions aren't properly getting deleted
      // and because of that, we simply run the command several times, because eventually the versions will be deleted
      // and consequently the buckets will be deleted
      // the reason we are using 7 as the number of times to run the command is because it’s the most amount of times I have had to run it to get it to delete everything
      try {
        log.info('Finalizing the removal of your cloud resources.')
        log.info('This will take a few moments...')
        // sometimes, this fails, so we need to retry it until all resources are deleted -> weird workaround, and would love a more stable alternative
        await loop(7, async () => {
          await runCommand('buddy cloud:cleanup', {
            ...options,
            cwd: p.projectPath(),
            stdout: 'ignore',
          })
        })

        await outro('Your cloud has been removed', {
          startTime,
          useSeconds: true,
        })
        process.exit(ExitCode.Success)
      }
      catch (error) {
        await outro('While cleaning up the cloud, there was an issue', { startTime, useSeconds: true }, error as Error)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('cloud:optimize-cost', descriptions.optimizeCost)
    .option('--jump-box', 'Remove the jump-box', { default: true }) // removes the ec2 instance
    // .option('--realtime-cdn-logs', 'Remove the CDN Realtime Log Stream', { default: true }) // TODO: implement this - removes the Kinesis Data Stream
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CloudCliOptions) => {
      log.debug('Running `buddy cloud:optimize-cost` ...', options)

      const startTime = await intro('buddy cloud:optimize-cost')

      if (options.jumpBox) {
        const { confirm } = await prompts({
          name: 'confirm',
          type: 'confirm',
          message: 'Would you like to remove your jump-box to optimize your costs?',
        })

        if (!confirm) {
          await outro('Exited', { startTime, useSeconds: true })
          process.exit(ExitCode.Success)
        }

        // at the moment, the jump-box is the only resource that is removed to optimize costs
        // because it can be re-applied at any later time
        await deleteJumpBox()

        await outro('Your jump-box was removed & cost optimizations are applied.', { startTime, useSeconds: true })
        process.exit(ExitCode.Success)
      }

      await outro('No cost optimization was applied', {
        startTime,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('cloud:cleanup', descriptions.cleanUp)
    .alias('cloud:clean-up')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CloudCliOptions) => {
      log.debug('Running `buddy cloud:cleanup` ...', options)

      const startTime = await intro('buddy cloud:cleanup')

      log.info(`Cleaning up your cloud resources will take a while to complete. Please be patient.`)

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
        await outro(
          'While deleting the retained S3 buckets, there was an issue',
          { startTime, useSeconds: true },
          result2.error,
        )
        process.exit(ExitCode.FatalError)
      }

      log.info('Removing any retained Lambda functions...')
      const result3 = await deleteStacksFunctions()

      if (result3.isErr()) {
        if (result3.error !== 'No stacks functions found') {
          await outro(
            'While deleting the Origin Request Lambda function, there was an issue',
            { startTime, useSeconds: true },
            result3.error,
          )
        }

        process.exit(ExitCode.FatalError)
      }

      log.info(result3.value)

      log.info('Removing any remaining Stacks logs...')
      const result4 = await deleteLogGroups()
      // TODO: investigate other regions for edge (cloudfront) logs

      if (result4.isErr()) {
        await outro(
          'While deleting the Stacks log groups, there was an issue',
          { startTime, useSeconds: true },
          result4.error,
        )
        process.exit(ExitCode.FatalError)
      }

      // log.info('Removing any Backup Vaults...')
      // const result5 = await deleteBackupVaults()

      // if (result5.isErr()) {
      //   await outro('While deleting the Backup Vaults, there was an issue', { startTime, useSeconds: true }, result5.error)
      //   process.exit(ExitCode.FatalError)
      // }

      log.info('Removing any stored parameters...')
      const result7 = await deleteParameterStore()

      if (result7.isErr()) {
        await outro(
          'While deleting the Stacks log groups, there was an issue',
          { startTime, useSeconds: true },
          result7.error,
        )
        process.exit(ExitCode.FatalError)
      }

      // delete all vpcs & subnets & internet gateways
      const result9 = await deleteVpcs()

      if (result9.isErr()) {
        await outro('While deleting the VPCs, there was an issue', { startTime, useSeconds: true }, result9.error)
        process.exit(ExitCode.FatalError)
      }

      const result10 = await deleteSubnets()

      if (result10.isErr()) {
        await outro('While deleting the Subnets, there was an issue', { startTime, useSeconds: true }, result10.error)
        process.exit(ExitCode.FatalError)
      }

      log.info('Removing any CDK remnants...')
      const result6 = await deleteCdkRemnants()

      if (result6.isErr()) {
        await outro(
          'While deleting the Stacks log groups, there was an issue',
          { startTime, useSeconds: true },
          result6.error,
        )
        process.exit(ExitCode.FatalError)
      }

      log.info('Removing any IAM users...')
      const result8 = await deleteIamUsers()

      if (result8.isErr()) {
        await outro(
          'While deleting the Stacks log groups, there was an issue',
          { startTime, useSeconds: true },
          result8.error,
        )
        process.exit(ExitCode.FatalError)
      }

      // TODO: needs to delete all Backup Vaults
      // TODO: needs to delete all KMS keys

      await outro('AWS resources have been removed', {
        startTime,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('cloud:invalidate-cache', descriptions.invalidateCache)
    .option('--paths [paths]', descriptions.paths, { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CloudCliOptions) => {
      log.debug('Running `buddy cloud:invalidate-cache` ...', options)

      const startTime = await intro('buddy cloud:invalidate-cache')

      const { confirm } = await prompts({
        name: 'confirm',
        type: 'confirm',
        message: 'Would you like to invalidate the CloudFront cache?',
      })

      if (!confirm) {
        await outro('Exited', { startTime, useSeconds: true })
        process.exit(ExitCode.Success)
      }

      log.info('Invalidating the CloudFront cache...')
      // const result = await runCommand('aws cloudfront create-invalidation --distribution-id E1U4Z2E9NJW9J --paths "/*"', {
      //   ...options,
      //   cwd: p.projectPath(),
      //   stdin: 'pipe',
      // })

      if (options.paths) {
        const result = await runCommand(
          `aws cloudfront create-invalidation --distribution-id E1U4Z2E9NJW9J --paths ${options.paths}`,
          {
            ...options,
            cwd: p.projectPath(), // TODO: this should be the cloud path
            stdin: 'pipe',
          },
        ) // TODO: this should be the cloud path

        if (result.isErr()) {
          await outro(
            'While running the cloud command, there was an issue',
            { startTime, useSeconds: true },
            result.error,
          )
          process.exit(ExitCode.FatalError)
        }

        await outro('Exited', { startTime, useSeconds: true })
        process.exit(ExitCode.Success)
      }

      log.info('Not implemented yet. Read more about `buddy cloud` here: https://stacksjs.org/docs/cloud')
      process.exit(ExitCode.Success)
    })

  buddy
    .command('cloud:diff', descriptions.diff)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CloudCliOptions) => {
      log.debug('Running `buddy cloud:diff` ...', options)

      const startTime = await intro('buddy cloud:diff')

      const result = await runCommand('bunx --bun cdk diff', {
        cwd: p.frameworkCloudPath(),
        stdin: 'pipe',
      })

      if (result.isErr()) {
        await outro(
          'While running the cloud diff command, there was an issue',
          { startTime, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Showing diff of the current, undeployed cloud changes', { startTime, useSeconds: true })
      console.log(result.value)
      process.exit(ExitCode.Success)
    })

  buddy.on('cloud:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
