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
  const { AWSClient } = await import('ts-cloud')
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
  const { AWSClient } = await import('ts-cloud')
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
        const { CloudFrontClient } = await import('ts-cloud')
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
    // .option('--realtime-cdn-logs', 'Remove the CDN Realtime Log Stream', { default: false }) // TODO: implement this
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CloudCliOptions) => {
      log.debug('Running `buddy cloud:remove` ...', options)

      // Load production environment variables
      const { loadEnv } = await import('@stacksjs/env')
      process.env.APP_ENV = 'production'
      process.env.NODE_ENV = 'production'
      loadEnv({
        path: ['.env', '.env.production'],
        overload: true,
      })

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
      console.log('')

      // sleep for 2 seconds to get the user to read the message
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Get app name and generate stack name
      const { app } = await import('@stacksjs/config')
      const appName = (process.env.APP_NAME || app.name || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
      const stackName = `${appName}-cloud`

      log.info(`Removing cloud stack: ${stackName}`)

      try {
        // Use ts-cloud's CloudFormation client instead of CDK
        const { CloudFormationClient } = await import('ts-cloud')

        // Unset AWS_PROFILE to force AWS SDK to use static credentials from .env.production
        delete process.env.AWS_PROFILE

        const cfnClient = new CloudFormationClient(
          process.env.AWS_REGION || 'us-east-1',
          undefined // Don't pass profile to ensure static credentials are used
        )

        // Try to delete the stack directly without checking if it exists first
        // This avoids issues with stacks in bad states where describeStacks might fail
        log.info('Attempting to delete cloud stack...')

        try {
          // Delete the stack without specifying roleArn to avoid CDK role issues
          await cfnClient.deleteStack(stackName)
          log.success('Stack deletion initiated')

          // Wait for deletion to complete
          log.info('Waiting for stack deletion to complete...')
          log.info('This may take several minutes...')

          try {
            await cfnClient.waitForStack(stackName, 'stack-delete-complete')
            log.success('Cloud stack deleted successfully')
          }
          catch (waitError: any) {
            // If waiting fails, the stack might already be deleted or in a terminal state
            const errorStr = String(waitError.message || waitError)
            if (errorStr.includes('does not exist')) {
              log.success('Cloud stack deleted successfully')
            }
            // Handle DELETE_FAILED - retry with retained resources
            else if (waitError.code === 'DELETE_FAILED' || errorStr.includes('DELETE_FAILED')) {
              log.warn('Stack deletion failed due to resources that could not be deleted')
              log.info('Identifying resources to retain...')

              try {
                // Get list of failed resources from stack events
                const resources = await cfnClient.listStackResources(stackName)
                const failedResources = resources
                  .filter((r: any) => r.ResourceStatus === 'DELETE_FAILED')
                  .map((r: any) => r.LogicalResourceId)

                if (failedResources.length > 0) {
                  log.info(`Found ${failedResources.length} resources to retain:`)
                  failedResources.forEach((r: string) => log.info(`  - ${r}`))

                  log.info('Retrying deletion with retained resources...')
                  await cfnClient.deleteStack(stackName, undefined, failedResources)
                  await cfnClient.waitForStack(stackName, 'stack-delete-complete')
                  log.success('Cloud stack deleted (some resources retained)')
                  log.info('Note: Retained resources remain in your AWS account and may need manual cleanup')
                }
                else {
                  throw waitError
                }
              }
              catch (retainError: any) {
                const retainErrorStr = String(retainError.message || retainError)
                if (retainErrorStr.includes('does not exist')) {
                  log.success('Cloud stack deleted successfully')
                }
                else {
                  throw retainError
                }
              }
            }
            else {
              throw waitError
            }
          }
        }
        catch (deleteError: any) {
          const errorStr = String(deleteError.message || deleteError)

          if (options.verbose) {
            log.debug('Delete error details:', deleteError)
          }

          // Stack doesn't exist - that's fine, nothing to delete
          if (errorStr.includes('does not exist')) {
            log.info('Cloud stack not found. Nothing to remove.')
            await outro('No cloud stack to remove', { startTime, useSeconds: true })
            process.exit(ExitCode.Success)
          }

          // ValidationError for CDK role issues
          if (errorStr.includes('ValidationError') && errorStr.includes('cdk-')) {
            console.log('')
            log.warn('Stack has invalid CDK execution role')

            if (options.verbose) {
              log.debug('Full error:', errorStr)
            }

            log.info('Attempting to delete CDK role and retry...')
            console.log('')

            // Extract the role ARN from the error message
            const roleMatch = errorStr.match(/arn:aws:iam::[0-9]+:role\/(cdk-[a-z0-9-]+)/)

            if (roleMatch && roleMatch[1]) {
              const roleName = roleMatch[1]
              console.log('')
              log.warn(`Stack requires CDK execution role: ${roleName}`)
              log.info('This role is missing or invalid. Creating it automatically...')
              console.log('')

              try {
                // Create the temporary IAM role
                try {
                  await createTemporaryCdkRole(roleName)
                }
                catch (roleCreateError: any) {
                  console.log('')
                  log.error('Failed to create IAM role automatically')
                  if (options.verbose) {
                    log.error(`Role creation error: ${String(roleCreateError.message || roleCreateError)}`)
                  }
                  throw roleCreateError
                }

                // Retry stack deletion
                console.log('')
                log.info('Retrying stack deletion with new IAM role...')
                await cfnClient.deleteStack(stackName)
                log.success('Stack deletion initiated')

                // Wait for deletion to complete
                log.info('Waiting for stack deletion to complete...')
                log.info('This may take several minutes...')

                try {
                  await cfnClient.waitForStack(stackName, 'stack-delete-complete')
                  log.success('Cloud stack deleted successfully')

                  // Clean up the temporary role
                  log.info('Cleaning up temporary IAM role...')
                  await deleteTemporaryCdkRole(roleName)

                  // Success! Exit early to avoid re-throwing the original error
                  console.log('')
                  await outro('Cloud stack removed successfully', { startTime, useSeconds: true })
                  process.exit(ExitCode.Success)
                }
                catch (waitError: any) {
                  const waitErrorStr = String(waitError.message || waitError)
                  if (waitErrorStr.includes('does not exist')) {
                    log.success('Cloud stack deleted successfully')
                    // Clean up the temporary role
                    await deleteTemporaryCdkRole(roleName)

                    // Success! Exit early to avoid re-throwing the original error
                    console.log('')
                    await outro('Cloud stack removed successfully', { startTime, useSeconds: true })
                    process.exit(ExitCode.Success)
                  }
                  else {
                    throw waitError
                  }
                }
              }
              catch (retryError: any) {
                console.log('')
                log.error('Failed to delete stack even after creating IAM role')

                if (options.verbose) {
                  log.error(`Retry error: ${String(retryError.message || retryError)}`)
                }

                console.log('')
                log.info('Please contact AWS Support to manually delete the stack.')
                console.log('')

                await outro('Could not delete stack', { startTime, useSeconds: true })
                process.exit(ExitCode.FatalError)
              }
            }
            else {
              console.log('')
              log.error('Could not extract role name from error')
              log.info('Try manual cleanup:')
              log.info('  buddy cloud:cleanup')
              console.log('')

              if (options.verbose) {
                log.error(`Full error: ${errorStr}`)
              }

              await outro('Stack has validation issues', { startTime, useSeconds: true })
              process.exit(ExitCode.FatalError)
            }
          }
          // Other validation errors
          else if (errorStr.includes('ValidationError')) {
            console.log('')
            log.error('Stack has validation issues')

            if (options.verbose) {
              log.error(`Full error: ${errorStr}`)
            }

            console.log('')
            log.info('Try manual cleanup:')
            log.info('  buddy cloud:cleanup')
            console.log('')

            await outro('Stack has validation issues', { startTime, useSeconds: true })
            process.exit(ExitCode.FatalError)
          }

          throw deleteError
        }
      }
      catch (error: any) {
        console.log('')
        log.error('Failed to remove cloud stack')

        // Check for common error patterns
        const errorStr = String(error.message || error)
        if (errorStr.includes('security token') || errorStr.includes('credentials')) {
          log.error('AWS credentials are invalid or expired')
          log.info('Please ensure your AWS credentials are properly configured')
          log.info('Run: buddy deploy  (to configure credentials)')
        }
        else if (errorStr.includes('region') || errorStr.includes('AWS_REGION')) {
          log.error('AWS Region is required. Please set AWS_REGION in your .env.production file')
        }
        else if (errorStr.includes('AccessDenied')) {
          log.error('Access denied. Your AWS credentials may not have permission to delete stacks')
        }
        else {
          log.error(`Error: ${errorStr}`)
        }

        console.log('')
        log.info('If the error persists, try running:')
        log.info('  buddy cloud:cleanup    # Clean up resources manually')
        console.log('')

        if (options.verbose) {
          console.error('Full error details:', error)
        }

        await outro(
          'While running cloud:remove, there was an issue',
          { startTime, useSeconds: true },
        )
        process.exit(ExitCode.FatalError)
      }

      log.info('Running cleanup to remove any retained resources...')

      try {
        await runCommand('buddy cloud:cleanup', {
          ...options,
          cwd: p.projectPath(),
          stdin: 'inherit',
        })
      }
      catch (e: any) {
        // Cleanup failures are non-fatal since main stack was deleted
        const errStr = String(e.message || e)
        if (errStr.includes('AuthFailure') || errStr.includes('credentials') || errStr.includes('not authorized')) {
          log.warn('Cleanup skipped - AWS SDK credentials issue')
        }
        else {
          log.warn(`Cleanup encountered issues: ${errStr}`)
        }
        log.info('Note: Some cleanup tasks may need manual completion via AWS Console')
      }

      await outro('Your cloud has been removed', {
        startTime,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
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

      // Load production environment variables for AWS credentials
      const { loadEnv } = await import('@stacksjs/env')
      process.env.APP_ENV = 'production'
      process.env.NODE_ENV = 'production'
      loadEnv({
        path: ['.env', '.env.production'],
        overload: true,
      })

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
