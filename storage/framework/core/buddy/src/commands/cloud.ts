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
      log.info('Removing your cloud infrastructure...')
      console.log(`   ${italic('This process typically takes 3-5 minutes to complete.')}`)
      console.log(`   ${italic('Your backups will be retained for 30 days before automatic deletion.')}`)
      console.log('')

      // Give user time to read the message
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Get app name and generate stack name
      const { app } = await import('@stacksjs/config')
      const appName = (process.env.APP_NAME || app.name || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
      const env = process.env.APP_ENV || 'production'
      const stackName = `${appName}-cloud-${env}`

      log.info(`Target: ${stackName}`)

      try {
        // Use ts-cloud's CloudFormation client
        const { CloudFormationClient } = await import('ts-cloud/aws')

        // Load AWS credentials from .env.production if not already set
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
          const { existsSync, readFileSync } = await import('node:fs')
          const { projectPath } = await import('@stacksjs/path')
          const prodEnvPath = projectPath('.env.production')

          if (existsSync(prodEnvPath)) {
            const envContent = readFileSync(prodEnvPath, 'utf-8')
            const lines = envContent.split('\n')

            for (const line of lines) {
              const trimmed = line.trim()
              if (trimmed.startsWith('#') || !trimmed.includes('='))
                continue

              const [key, ...valueParts] = trimmed.split('=')
              const value = valueParts.join('=').replace(/^["']|["']$/g, '')

              if (key === 'AWS_ACCESS_KEY_ID' || key === 'AWS_SECRET_ACCESS_KEY' || key === 'AWS_REGION') {
                process.env[key] = value
              }
            }

            if (process.env.AWS_ACCESS_KEY_ID) {
              log.success('Loaded AWS credentials from .env.production')
            }
          }
        }

        // Use static credentials from .env.production
        delete process.env.AWS_PROFILE

        const cfnClient = new CloudFormationClient(
          process.env.AWS_REGION || 'us-east-1'
        )

        // Clean up any manually added HTTPS listeners before deleting the stack
        // This prevents DELETE_FAILED on WebTargetGroup due to external references
        log.info('Checking for HTTPS listeners to clean up...')
        try {
          const { AWSClient } = await import('ts-cloud/aws')
          const client = new AWSClient()
          const region = process.env.AWS_REGION || 'us-east-1'

          // Get ALB from stack resources
          const resourcesResult = await cfnClient.listStackResources(stackName)
          const resources = resourcesResult.StackResourceSummaries || []

          if (options.verbose) {
            log.debug(`Found ${resources.length} stack resources`)
          }

          const albResource = resources.find((r: any) => r.LogicalResourceId === 'ApplicationLoadBalancer')

          if (!albResource?.PhysicalResourceId) {
            if (options.verbose) {
              log.debug('No ALB found in stack resources - skipping listener cleanup')
            }
          }

          if (albResource?.PhysicalResourceId) {
            const albArn = albResource.PhysicalResourceId

            // Get all listeners
            const listParams = {
              Action: 'DescribeListeners',
              LoadBalancerArn: albArn,
              Version: '2015-12-01',
            }

            const listResult = await client.request({
              service: 'elasticloadbalancing',
              region,
              method: 'POST',
              path: '/',
              body: new URLSearchParams(listParams as any).toString(),
            })

            // Handle both response formats (with and without Response wrapper)
            const listeners = listResult?.DescribeListenersResult?.Listeners?.member
              || listResult?.DescribeListenersResponse?.DescribeListenersResult?.Listeners?.member
            const listenerList = Array.isArray(listeners) ? listeners : listeners ? [listeners] : []

            if (options.verbose) {
              log.debug(`Found ${listenerList.length} listeners on ALB`)
            }

            // Delete any HTTPS listeners (they're manually added and not part of the stack)
            let deletedListeners = 0
            for (const listener of listenerList) {
              if (listener.Protocol === 'HTTPS') {
                log.info(`Cleaning up HTTPS listener on port ${listener.Port}...`)
                const deleteParams = {
                  Action: 'DeleteListener',
                  ListenerArn: listener.ListenerArn,
                  Version: '2015-12-01',
                }

                await client.request({
                  service: 'elasticloadbalancing',
                  region,
                  method: 'POST',
                  path: '/',
                  body: new URLSearchParams(deleteParams as any).toString(),
                })
                deletedListeners++
              }
            }

            // Wait for AWS to propagate listener deletion before proceeding
            if (deletedListeners > 0) {
              log.info('Waiting for listener cleanup to propagate...')
              await new Promise(resolve => setTimeout(resolve, 3000))
            }
          }
        }
        catch (cleanupError: any) {
          // Log cleanup errors - they're important for debugging but shouldn't block deletion
          const cleanupErrorMsg = cleanupError?.message || String(cleanupError)
          log.warn(`HTTPS listener cleanup warning: ${cleanupErrorMsg}`)
          if (options.verbose) {
            log.debug('Full cleanup error details:', cleanupError)
          }
        }

        // Initiate stack deletion
        log.info('Initiating stack deletion...')

        try {
          await cfnClient.deleteStack(stackName)
          log.success('Deletion request accepted')

          // Wait for deletion with progress indication
          log.info('Deleting resources (this takes 3-5 minutes)...')

          try {
            await cfnClient.waitForStack(stackName, 'stack-delete-complete')
            console.log('')
            log.success('Infrastructure removed successfully!')
          }
          catch (waitError: any) {
            // If waiting fails, the stack might already be deleted or in a terminal state
            const errorStr = String(waitError.message || waitError)
            if (errorStr.includes('does not exist')) {
              console.log('')
              log.success('Infrastructure removed successfully!')
            }
            // Handle DELETE_FAILED - retry with retained resources
            else if (waitError.code === 'DELETE_FAILED' || errorStr.includes('DELETE_FAILED')) {
              console.log('')
              log.warn('Some resources could not be deleted automatically')
              log.info('Identifying resources to retain...')

              try {
                // Get list of failed resources from stack events
                const resourcesResult = await cfnClient.listStackResources(stackName)
                const resources = resourcesResult.StackResourceSummaries || []
                const failedResources = resources
                  .filter((r: any) => r.ResourceStatus === 'DELETE_FAILED')
                  .map((r: any) => r.LogicalResourceId)

                if (failedResources.length > 0) {
                  log.info(`Retaining ${failedResources.length} resource(s):`)
                  failedResources.forEach((r: string) => log.info(`  - ${r}`))
                  console.log('')

                  // Capture physical resource IDs before stack deletion
                  const retainedResourceInfo = resources
                    .filter((r: any) => failedResources.includes(r.LogicalResourceId))
                    .map((r: any) => ({
                      logicalId: r.LogicalResourceId,
                      physicalId: r.PhysicalResourceId,
                      type: r.ResourceType,
                    }))

                  log.info('Retrying with retained resources...')
                  await cfnClient.deleteStack(stackName, undefined, failedResources)
                  await cfnClient.waitForStack(stackName, 'stack-delete-complete')
                  console.log('')
                  log.success('Stack removed (with retained resources)')

                  // Now try to clean up retained resources manually
                  log.info('Cleaning up retained resources...')
                  const { AWSClient } = await import('ts-cloud/aws')
                  const client = new AWSClient()
                  const region = process.env.AWS_REGION || 'us-east-1'

                  for (const resource of retainedResourceInfo) {
                    try {
                      if (resource.type === 'AWS::ElasticLoadBalancingV2::TargetGroup' && resource.physicalId) {
                        log.info(`  Deleting target group: ${resource.logicalId}...`)
                        const deleteParams = {
                          Action: 'DeleteTargetGroup',
                          TargetGroupArn: resource.physicalId,
                          Version: '2015-12-01',
                        }
                        await client.request({
                          service: 'elasticloadbalancing',
                          region,
                          method: 'POST',
                          path: '/',
                          body: new URLSearchParams(deleteParams as any).toString(),
                        })
                        log.success(`  Deleted ${resource.logicalId}`)
                      }
                      else if (resource.type === 'AWS::S3::Bucket' && resource.physicalId) {
                        log.info(`  Deleting S3 bucket: ${resource.logicalId}...`)
                        const { S3Client } = await import('ts-cloud/aws')
                        const s3 = new S3Client(region)
                        await s3.emptyAndDeleteBucket(resource.physicalId)
                        log.success(`  Deleted ${resource.logicalId}`)
                      }
                      else {
                        log.info(`  Skipped ${resource.logicalId} (${resource.type}) - manual cleanup may be required`)
                      }
                    }
                    catch (resourceError: any) {
                      log.warn(`  Could not delete ${resource.logicalId}: ${resourceError?.message || resourceError}`)
                    }
                  }

                  console.log('')
                  log.success('Infrastructure removed successfully!')
                }
                else {
                  throw waitError
                }
              }
              catch (retainError: any) {
                const retainErrorStr = String(retainError.message || retainError)
                if (retainErrorStr.includes('does not exist')) {
                  console.log('')
                  log.success('Infrastructure removed successfully!')
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
            console.log('')
            log.info(`No cloud infrastructure found for "${stackName}"`)
            await outro('Nothing to remove', { startTime, useSeconds: true })
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
        log.error('Failed to remove cloud infrastructure')

        // Check for common error patterns
        const errorStr = String(error.message || error)
        if (errorStr.includes('security token') || errorStr.includes('credentials')) {
          console.log('')
          log.error('AWS credentials are invalid or expired')
          log.info('Check your AWS credentials in .env.production:')
          log.info('  - AWS_ACCESS_KEY_ID')
          log.info('  - AWS_SECRET_ACCESS_KEY')
        }
        else if (errorStr.includes('region') || errorStr.includes('AWS_REGION')) {
          console.log('')
          log.error('AWS Region not configured')
          log.info('Add AWS_REGION to your .env.production file')
        }
        else if (errorStr.includes('AccessDenied')) {
          console.log('')
          log.error('Access denied')
          log.info('Your AWS credentials may not have permission to delete stacks')
          log.info('Required permissions: CloudFormation:DeleteStack, IAM:*, EC2:*, S3:*')
        }
        else {
          log.error(errorStr)
        }

        console.log('')
        log.info('Troubleshooting:')
        log.info('  buddy cloud:cleanup   - Clean up resources manually')
        log.info('  --verbose             - Show detailed error information')
        console.log('')

        if (options.verbose) {
          console.error('Error details:', error)
        }

        await outro('Failed to remove infrastructure', { startTime, useSeconds: true })
        process.exit(ExitCode.FatalError)
      }

      // Run cleanup for any retained resources
      console.log('')
      log.info('Cleaning up retained resources...')

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
          log.warn('Cleanup skipped due to credential issues')
        }
        else {
          log.warn('Some cleanup tasks may need manual completion')
        }
      }

      console.log('')
      await outro('Cloud infrastructure removed', { startTime, useSeconds: true })
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
