import type { CLI, CloudCliOptions } from '@stacksjs/types'
import process from 'node:process'
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

/**
 * Create a temporary IAM role to allow CloudFormation to delete a stuck stack
 * Uses raw AWS API calls since AWS SDK has dependency issues with Bun
 */
async function createTemporaryCdkRole(roleName: string): Promise<void> {
  // Import AWSClient for direct IAM API calls
  const { AWSClient } = await import('ts-cloud/aws')
  const client = new AWSClient()

  // Trust policy that allows CloudFormation to assume this role
  const trustPolicy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: {
          Service: 'cloudformation.amazonaws.com',
        },
        Action: 'sts:AssumeRole',
      },
    ],
  }

  try {
    // Check if role already exists
    try {
      const getRoleParams = new URLSearchParams({
        Action: 'GetRole',
        RoleName: roleName,
        Version: '2010-05-08',
      })

      await client.request({
        service: 'iam',
        region: 'us-east-1', // IAM is global but needs us-east-1 for signing
        method: 'POST',
        path: '/',
        body: getRoleParams.toString(),
      })

      log.debug(`Role ${roleName} already exists`)
      return
    }
    catch (e: any) {
      // Role doesn't exist - this is expected, continue to create it
      if (!e.message?.includes('NoSuchEntity') && !e.message?.includes('cannot be found')) {
        throw e
      }
    }

    // Create the role
    log.info('Creating temporary IAM role to enable stack deletion...')

    const createRoleParams = new URLSearchParams({
      Action: 'CreateRole',
      RoleName: roleName,
      AssumeRolePolicyDocument: JSON.stringify(trustPolicy),
      Description: 'Temporary role to allow CloudFormation to delete stuck stack',
      Version: '2010-05-08',
    })

    await client.request({
      service: 'iam',
      region: 'us-east-1',
      method: 'POST',
      path: '/',
      body: createRoleParams.toString(),
    })

    log.success('Created IAM role')

    // Attach AdministratorAccess policy to ensure it can delete any resources
    log.info('Attaching permissions...')

    const attachPolicyParams = new URLSearchParams({
      Action: 'AttachRolePolicy',
      RoleName: roleName,
      PolicyArn: 'arn:aws:iam::aws:policy/AdministratorAccess',
      Version: '2010-05-08',
    })

    await client.request({
      service: 'iam',
      region: 'us-east-1',
      method: 'POST',
      path: '/',
      body: attachPolicyParams.toString(),
    })

    log.success('IAM role ready for stack deletion')

    // Wait a few seconds for IAM to propagate
    log.info('Waiting for IAM role to propagate...')
    await new Promise(resolve => setTimeout(resolve, 10000))
  }
  catch (error: any) {
    if (error.message?.includes('EntityAlreadyExists')) {
      log.debug('Role already exists')
    }
    else {
      throw error
    }
  }
}

/**
 * Delete the temporary IAM role after stack deletion
 * Uses raw AWS API calls since AWS SDK has dependency issues with Bun
 */
async function deleteTemporaryCdkRole(roleName: string): Promise<void> {
  const { AWSClient } = await import('ts-cloud/aws')
  const client = new AWSClient()

  try {
    // First, detach the AdministratorAccess policy
    const detachPolicyParams = new URLSearchParams({
      Action: 'DetachRolePolicy',
      RoleName: roleName,
      PolicyArn: 'arn:aws:iam::aws:policy/AdministratorAccess',
      Version: '2010-05-08',
    })

    await client.request({
      service: 'iam',
      region: 'us-east-1',
      method: 'POST',
      path: '/',
      body: detachPolicyParams.toString(),
    })

    // Then delete the role
    const deleteRoleParams = new URLSearchParams({
      Action: 'DeleteRole',
      RoleName: roleName,
      Version: '2010-05-08',
    })

    await client.request({
      service: 'iam',
      region: 'us-east-1',
      method: 'POST',
      path: '/',
      body: deleteRoleParams.toString(),
    })

    log.success('Cleaned up temporary IAM role')
  }
  catch (error: any) {
    // Don't fail if cleanup doesn't work - role will be orphaned but harmless
    log.debug(`Could not clean up temporary role: ${error.message}`)
  }
}

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

        // Use ts-cloud CloudFront client instead of AWS SDK
        const { CloudFrontClient } = await import('ts-cloud/aws')
        const cloudfront = new CloudFrontClient()
        const distributionId = await getCloudFrontDistributionId()

        try {
          const result = await cloudfront.invalidateAll(distributionId)
          log.success(`Invalidation created: ${result.Id}`)
          log.info(`Status: ${result.Status}`)
        }
        catch (err: any) {
          log.error(`Failed to invalidate CloudFront cache: ${err.message}`)
        }

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
    .option('--force', 'Force deletion of stack in bad state', { default: false })
    .option('--yes', 'Skip confirmation prompts', { default: false })
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

      console.log('')
      console.log('Removing cloud infrastructure...')
      console.log(`   ${italic('This typically takes 2-5 minutes.')}`)
      console.log('')

      // Determine environment first
      const environment = process.env.APP_ENV || process.env.NODE_ENV || 'production'

      // Load AWS credentials from environment-specific .env file if not already set
      if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        const { existsSync, readFileSync } = await import('node:fs')
        const { projectPath } = await import('@stacksjs/path')

        // Try environment-specific file first (e.g., .env.staging, .env.production)
        const envFiles = [
          projectPath(`.env.${environment}`),
          projectPath('.env'),
        ]

        for (const envPath of envFiles) {
          if (existsSync(envPath)) {
            const envContent = readFileSync(envPath, 'utf-8')
            const lines = envContent.split('\n')

            for (const line of lines) {
              const trimmed = line.trim()
              if (trimmed.startsWith('#') || !trimmed.includes('='))
                continue

              const [key, ...valueParts] = trimmed.split('=')
              const value = valueParts.join('=').replace(/^["']|["']$/g, '')

              if (key === 'AWS_ACCESS_KEY_ID' || key === 'AWS_SECRET_ACCESS_KEY' || key === 'AWS_REGION' || key === 'AWS_ACCOUNT_ID') {
                process.env[key] = value
              }
            }
            break // Stop after loading the first existing file
          }
        }
      }

      // Use static credentials from environment-specific .env file
      delete process.env.AWS_PROFILE

      // Use the new undeployStack function with CDK-style status updates
      try {
        const { undeployStack } = await import('../../../actions/deploy')

        const region = process.env.AWS_REGION || 'us-east-1'

        await undeployStack({
          environment,
          region,
          verbose: options.verbose,
        })

        // Cleanup is already handled by CloudFormation - retained resources (like S3)
        // are intentional and can be cleaned up separately with `./buddy cloud:cleanup`

        await outro('Cloud infrastructure removed', { startTime, useSeconds: true })
        process.exit(ExitCode.Success)
      }
      catch (error: any) {
        console.log('')
        console.error('✗ Failed to remove cloud infrastructure')

        // Check for common error patterns
        const errorStr = String(error.message || error)
        if (errorStr.includes('security token') || errorStr.includes('credentials')) {
          console.log('')
          console.error('  AWS credentials are invalid or expired')
          console.log('  Check your AWS credentials in .env.production:')
          console.log('    - AWS_ACCESS_KEY_ID')
          console.log('    - AWS_SECRET_ACCESS_KEY')
        }
        else if (errorStr.includes('region') || errorStr.includes('AWS_REGION')) {
          console.log('')
          console.error('  AWS Region not configured')
          console.log('  Add AWS_REGION to your .env.production file')
        }
        else if (errorStr.includes('AccessDenied')) {
          console.log('')
          console.error('  Access denied')
          console.log('  Your AWS credentials may not have permission to delete stacks')
        }
        else {
          console.error(`  ${errorStr}`)
        }

        console.log('')
        console.log('Troubleshooting:')
        console.log('  ./buddy cloud:cleanup   - Clean up resources manually')
        console.log('  --verbose               - Show detailed error information')
        console.log('')

        if (options.verbose) {
          console.error('Error details:', error)
        }

        await outro('Failed to remove infrastructure', { startTime, useSeconds: true })
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

      // Unset AWS_PROFILE to force AWS SDK to use static credentials from .env.production
      delete process.env.AWS_PROFILE

      log.info(`Cleaning up your cloud resources will take a while to complete. Please be patient.`)

      // sleep for 2 seconds to get the user to read the message
      await new Promise(resolve => setTimeout(resolve, 2000))

      log.info('Removing any jump-boxes...')
      try {
        const result = await deleteJumpBox()
        if (result && typeof result.isErr === 'function' && result.isErr()) {
          if (result.error !== 'Jump-box not found') {
            log.warn(`Jump-box cleanup issue: ${result.error}`)
          }
        }
      }
      catch (e: any) {
        log.warn(`Jump-box cleanup skipped: ${e.message || 'AWS SDK error'}`)
      }

      log.info('Removing any retained S3 buckets...')
      try {
        const result2 = await deleteStacksBuckets()
        if (result2 && typeof result2.isErr === 'function' && result2.isErr()) {
          log.warn(`S3 cleanup issue: ${result2.error}`)
        }
      }
      catch (e: any) {
        log.warn(`S3 cleanup skipped: ${e.message || 'AWS SDK error'}`)
      }

      log.info('Removing any retained Lambda functions...')
      try {
        const result3 = await deleteStacksFunctions()
        if (result3 && typeof result3.isErr === 'function' && result3.isErr()) {
          if (result3.error !== 'No stacks functions found') {
            log.warn(`Lambda cleanup issue: ${result3.error}`)
          }
        }
        else if (result3?.value) {
          log.info(result3.value)
        }
      }
      catch (e: any) {
        log.warn(`Lambda cleanup skipped: ${e.message || 'AWS SDK error'}`)
      }

      log.info('Removing any remaining Stacks logs...')
      try {
        const result4 = await deleteLogGroups()
        if (result4 && typeof result4.isErr === 'function' && result4.isErr()) {
          log.warn(`Log groups cleanup issue: ${result4.error}`)
        }
      }
      catch (e: any) {
        log.warn(`Log groups cleanup skipped: ${e.message || 'AWS SDK error'}`)
      }

      // log.info('Removing any Backup Vaults...')
      // const result5 = await deleteBackupVaults()

      // if (result5.isErr()) {
      //   await outro('While deleting the Backup Vaults, there was an issue', { startTime, useSeconds: true }, result5.error)
      //   process.exit(ExitCode.FatalError)
      // }

      log.info('Removing any stored parameters...')
      try {
        const result7 = await deleteParameterStore()
        if (result7 && typeof result7.isErr === 'function' && result7.isErr()) {
          log.warn(`Parameter store cleanup issue: ${result7.error}`)
        }
      }
      catch (e: any) {
        log.warn(`Parameter store cleanup skipped: ${e.message || 'AWS SDK error'}`)
      }

      // delete all vpcs & subnets & internet gateways
      log.info('Removing any VPCs...')
      try {
        const result9 = await deleteVpcs()
        if (result9 && typeof result9.isErr === 'function' && result9.isErr()) {
          log.warn(`VPC cleanup issue: ${result9.error}`)
        }
      }
      catch (e: any) {
        log.warn(`VPC cleanup skipped: ${e.message || 'AWS SDK error'}`)
      }

      log.info('Removing any Subnets...')
      try {
        const result10 = await deleteSubnets()
        if (result10 && typeof result10.isErr === 'function' && result10.isErr()) {
          log.warn(`Subnet cleanup issue: ${result10.error}`)
        }
      }
      catch (e: any) {
        log.warn(`Subnet cleanup skipped: ${e.message || 'AWS SDK error'}`)
      }

      log.info('Removing any CDK remnants...')
      try {
        const result6 = await deleteCdkRemnants()
        if (result6 && typeof result6.isErr === 'function' && result6.isErr()) {
          log.warn(`CDK remnants cleanup issue: ${result6.error}`)
        }
      }
      catch (e: any) {
        log.warn(`CDK remnants cleanup skipped: ${e.message || 'AWS SDK error'}`)
      }

      log.info('Removing any IAM users...')
      try {
        const result8 = await deleteIamUsers()
        if (result8 && typeof result8.isErr === 'function' && result8.isErr()) {
          log.warn(`IAM users cleanup issue: ${result8.error}`)
        }
      }
      catch (e: any) {
        log.warn(`IAM users cleanup skipped: ${e.message || 'AWS SDK error'}`)
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
