/**
 * Stack Deployment Module
 *
 * Handles full infrastructure stack deployment using ts-cloud CloudFormation.
 * Generates and deploys infrastructure based on cloud.config.ts
 */

import type { CloudConfig, EnvironmentType } from '@stacksjs/ts-cloud'
import { AWSCloudFormationClient as CloudFormationClient, InfrastructureGenerator, Route53Client, SESClient } from '@stacksjs/ts-cloud'

// Import tsCloud config from Stacks config system
import { tsCloud as config } from '~/config/cloud'

/**
 * Retry an async operation with exponential backoff and jitter
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelayMs?: number; maxDelayMs?: number; label?: string } = {},
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 500, maxDelayMs = 10000, label = 'operation' } = options
  let lastError: Error | undefined
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    }
    catch (error: any) {
      lastError = error
      // Don't retry on non-transient errors
      const message = error.message || ''
      if (message.includes('ValidationError') || message.includes('AccessDenied') || message.includes('InvalidParameter')) {
        throw error
      }
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelayMs * 2 ** attempt + Math.random() * baseDelayMs, maxDelayMs)
        console.log(`   ⟳ Retrying ${label} (attempt ${attempt + 2}/${maxRetries + 1}) in ${Math.round(delay)}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}

export interface StackDeployOptions {
  environment: string
  region: string
  stackName?: string
  waitForCompletion?: boolean
  verbose?: boolean
  timeoutMinutes?: number
}

/**
 * Deploy infrastructure stack using CloudFormation
 */
export async function deployStack(options: StackDeployOptions): Promise<void> {
  const {
    environment,
    region,
    stackName,
    waitForCompletion = true,
  } = options

  console.log('🏗️  Deploying infrastructure stack...')
  console.log(`   Environment: ${environment}`)
  console.log(`   Region: ${region}\n`)

  // Use bunfig-loaded config
  const cloudConfig = config as CloudConfig
  const envConfig = cloudConfig.environments?.[environment]

  if (!envConfig) {
    throw new Error(`Environment "${environment}" not found in cloud.config.ts`)
  }

  // Generate CloudFormation template
  console.log('📝 Generating CloudFormation template...')

  const generator = new InfrastructureGenerator({
    config: cloudConfig,
    environment: environment as EnvironmentType,
  })

  const template = generator.generate().toJSON()
  console.log(`   ✅ Template generated (${template.length} bytes)`)

  // Initialize CloudFormation client
  const cfn = new CloudFormationClient(region)

  // Determine stack name
  const finalStackName = stackName || `${cloudConfig.project.slug}-cloud`

  console.log(`\n☁️  Deploying to CloudFormation...`)
  console.log(`   Stack: ${finalStackName}`)

  // Check if stack exists
  let stackExists = false
  try {
    const stacks = await withRetry(
      () => cfn.describeStacks({ stackName: finalStackName }),
      { label: 'describeStacks' },
    )
    stackExists = stacks.Stacks && stacks.Stacks.length > 0
  } catch (error: any) {
    const msg = error.message || ''
    // Only treat "does not exist" as stack-not-found
    if (msg.includes('does not exist') || msg.includes('Stack with id') || msg.includes('not found')) {
      stackExists = false
    } else {
      // Auth errors, rate limits, network issues — don't silently swallow
      throw error
    }
  }

  if (stackExists) {
    // Re-check current state before acting (handles race conditions)
    const stateCheck = await withRetry(
      () => cfn.describeStacks({ stackName: finalStackName }),
      { label: 'state check' },
    )
    const currentStatus = stateCheck.Stacks?.[0]?.StackStatus || ''

    // Wait for any in-progress operation to finish
    if (currentStatus.endsWith('_IN_PROGRESS')) {
      console.log(`   Stack is busy (${currentStatus}). Waiting...`)
      const waitType = currentStatus.startsWith('DELETE')
        ? 'DELETE_COMPLETE'
        : currentStatus.startsWith('CREATE')
          ? 'CREATE_COMPLETE'
          : 'UPDATE_COMPLETE'
      await waitForStackComplete(cfn, finalStackName, waitType)
      // Re-check after operation completes
      const refreshed = await cfn.describeStacks({ stackName: finalStackName })
      if (!refreshed.Stacks?.length || refreshed.Stacks[0].StackStatus === 'DELETE_COMPLETE') {
        stackExists = false
      }
    }

    // UPDATE_ROLLBACK_COMPLETE is safe -- previous update rolled back, ready for new update
    if (currentStatus === 'UPDATE_ROLLBACK_COMPLETE') {
      console.log('   Stack rolled back from a previous update. Re-deploying...')
      // Fall through to update below
    }
    // Failed initial creation -- must delete and recreate
    else if (currentStatus === 'ROLLBACK_COMPLETE' || currentStatus === 'ROLLBACK_FAILED' || currentStatus === 'CREATE_FAILED') {
      console.log(`   Stack is in ${currentStatus} state. Deleting before recreating...`)
      await cfn.deleteStack(finalStackName)
      await waitForStackDelete(cfn, finalStackName)
      stackExists = false
    }
    // Fully deleted -- treat as non-existent
    else if (currentStatus === 'DELETE_COMPLETE') {
      stackExists = false
    }
  }

  // Pre-deploy: clean up orphaned Route53 records that would conflict with the template
  // This handles records created by previous failed deployments that CF rolled back
  // but didn't delete from Route53
  await cleanupOrphanedRoute53Records(template, cfn, finalStackName, region)

  // Pre-deploy: clean up SES suppression list for email recipients
  // Addresses may get suppressed due to bounces during setup (e.g., before MX record exists)
  await cleanupSesSuppressionList(cloudConfig, region)

  if (stackExists) {
    console.log('   📦 Stack exists, updating...')

    try {
      const result = await cfn.updateStack({
        stackName: finalStackName,
        templateBody: template,
        capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
        tags: {
          Environment: environment,
          Project: cloudConfig.project.name,
          ManagedBy: 'stacks',
        },
      })

      console.log(`   ✅ Stack update initiated`)
      console.log(`   Stack ID: ${result.StackId}`)

      if (waitForCompletion) {
        await waitForStackComplete(cfn, finalStackName, 'UPDATE_COMPLETE')
      }
    } catch (error: any) {
      if (error.message?.includes('No updates are to be performed')) {
        console.log('   ℹ️  No changes detected - stack is up to date')
      } else {
        throw error
      }
    }
  } else {
    console.log('   🆕 Creating new stack...')

    const result = await cfn.createStack({
      stackName: finalStackName,
      templateBody: template,
      capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
      tags: {
        Environment: environment,
        Project: cloudConfig.project.name,
        ManagedBy: 'stacks',
      },
      onFailure: 'ROLLBACK',
    })

    console.log(`   ✅ Stack creation initiated`)
    console.log(`   Stack ID: ${result.StackId}`)

    if (waitForCompletion) {
      await waitForStackComplete(cfn, finalStackName, 'CREATE_COMPLETE')
    }
  }

  // Get stack outputs
  if (waitForCompletion) {
    const outputsResult = await cfn.describeStacks({ stackName: finalStackName })
    const stack = outputsResult.Stacks?.[0]

    if (stack?.Outputs && stack.Outputs.length > 0) {
      console.log('\n📋 Stack Outputs:')
      for (const output of stack.Outputs) {
        console.log(`   ${output.OutputKey}: ${output.OutputValue}`)
      }
    }
  }

  console.log('\n✅ Stack deployment completed!')
}

/**
 * Wait for stack operation to complete
 */
async function waitForStackComplete(
  cfn: CloudFormationClient,
  stackName: string,
  targetStatus: string,
  timeoutMinutes = 20,
): Promise<void> {
  console.log(`\n⏳ Waiting for stack to reach ${targetStatus} (timeout: ${timeoutMinutes}m)...`)

  const startTime = Date.now()
  const timeoutMs = timeoutMinutes * 60 * 1000
  let pollInterval = 5000 // start at 5s
  const maxPollInterval = 15000 // cap at 15s
  let lastDisplayedEvent: string | null = null

  while (Date.now() - startTime < timeoutMs) {
    const pollResult = await withRetry(
      () => cfn.describeStacks({ stackName }),
      { label: 'poll describeStacks' },
    )
    const stack = pollResult.Stacks?.[0]

    if (!stack) {
      throw new Error(`Stack ${stackName} not found`)
    }

    // Show recent events
    try {
      const eventsResult = await cfn.describeStackEvents(stackName)
      const recentEvent = eventsResult.StackEvents?.[0]

      if (recentEvent && recentEvent.Timestamp !== lastDisplayedEvent) {
        const status = recentEvent.ResourceStatus
        const resource = recentEvent.LogicalResourceId
        const reason = recentEvent.ResourceStatusReason || ''

        console.log(`   [${status}] ${resource} ${reason}`)
        lastDisplayedEvent = recentEvent.Timestamp
      }
    } catch {
      // Ignore event fetch errors - non-critical
    }

    // Check if complete
    if (stack.StackStatus === targetStatus) {
      console.log(`   ✅ Stack ${targetStatus}`)
      return
    }

    // Check for failure states
    if (
      stack.StackStatus.includes('FAILED') ||
      stack.StackStatus.includes('ROLLBACK_COMPLETE')
    ) {
      throw new Error(`Stack operation failed: ${stack.StackStatus}`)
    }

    // Wait with increasing interval (exponential backoff capped at 15s)
    await new Promise(resolve => setTimeout(resolve, pollInterval))
    pollInterval = Math.min(pollInterval * 1.2, maxPollInterval)
  }

  const elapsedMin = Math.round((Date.now() - startTime) / 60000)
  throw new Error(`Timeout after ${elapsedMin}m waiting for stack to reach ${targetStatus}`)
}

/**
 * Delete infrastructure stack
 */
export async function deleteStack(options: {
  stackName: string
  region: string
  waitForCompletion?: boolean
}): Promise<void> {
  const { stackName, region, waitForCompletion = true } = options

  console.log('🗑️  Deleting infrastructure stack...')
  console.log(`   Stack: ${stackName}`)
  console.log(`   Region: ${region}\n`)

  const cfn = new CloudFormationClient(region)

  await cfn.deleteStack(stackName)
  console.log('   ✅ Stack deletion initiated')

  if (waitForCompletion) {
    await waitForStackDelete(cfn, stackName)
  }

  console.log('\n✅ Stack deleted successfully!')
}

/**
 * Wait for stack deletion to complete
 */
async function waitForStackDelete(
  cfn: CloudFormationClient,
  stackName: string,
  timeoutMinutes = 30,
): Promise<void> {
  console.log(`\n⏳ Waiting for stack deletion (timeout: ${timeoutMinutes}m)...`)

  const startTime = Date.now()
  const timeoutMs = timeoutMinutes * 60 * 1000
  let pollInterval = 5000

  while (Date.now() - startTime < timeoutMs) {
    try {
      const deleteResult = await withRetry(
        () => cfn.describeStacks({ stackName }),
        { label: 'poll delete describeStacks' },
      )
      const stack = deleteResult.Stacks?.[0]

      if (!stack) {
        console.log('   ✅ Stack deleted')
        return
      }

      if (stack.StackStatus === 'DELETE_FAILED') {
        throw new Error('Stack deletion failed')
      }

      console.log(`   [${stack.StackStatus}] Deleting...`)
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
        console.log('   ✅ Stack deleted')
        return
      }
      throw error
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval))
    pollInterval = Math.min(pollInterval * 1.2, 15000)
  }

  const elapsedMin = Math.round((Date.now() - startTime) / 60000)
  throw new Error(`Timeout after ${elapsedMin}m waiting for stack deletion`)
}

/**
 * Get stack status and outputs
 */
export async function getStackInfo(options: {
  stackName: string
  region: string
}): Promise<void> {
  const { stackName, region } = options

  console.log('📊 Stack Information\n')

  const cfn = new CloudFormationClient(region)
  const infoResult = await cfn.describeStacks({ stackName })
  const stack = infoResult.Stacks?.[0]

  if (!stack) {
    console.log('   ❌ Stack not found')
    return
  }

  console.log(`   Name: ${stack.StackName}`)
  console.log(`   Status: ${stack.StackStatus}`)
  console.log(`   Created: ${stack.CreationTime}`)
  if (stack.LastUpdatedTime) {
    console.log(`   Updated: ${stack.LastUpdatedTime}`)
  }

  if (stack.Outputs && stack.Outputs.length > 0) {
    console.log('\n   Outputs:')
    for (const output of stack.Outputs) {
      console.log(`   - ${output.OutputKey}: ${output.OutputValue}`)
    }
  }

  if (stack.Parameters && stack.Parameters.length > 0) {
    console.log('\n   Parameters:')
    for (const param of stack.Parameters) {
      console.log(`   - ${param.ParameterKey}: ${param.ParameterValue}`)
    }
  }
}

/**
 * Clean up orphaned Route53 records that would conflict with CloudFormation
 *
 * When a CF stack update fails and rolls back, Route53 records created during
 * the failed update may remain orphaned (not managed by the stack). Subsequent
 * deploys then fail with "already exists" errors. This function detects and
 * removes those orphaned records so CF can recreate them as managed resources.
 */
async function cleanupOrphanedRoute53Records(
  templateJson: string,
  cfn: CloudFormationClient,
  stackName: string,
  region: string,
): Promise<void> {
  try {
    const template = JSON.parse(templateJson)
    const resources = template.Resources || {}

    // Find all Route53 RecordSet resources in the template
    const route53Records: Array<{
      logicalId: string
      name: string
      type: string
      hostedZoneId: string
    }> = []

    for (const [logicalId, resource] of Object.entries(resources)) {
      const res = resource as any
      if (res.Type !== 'AWS::Route53::RecordSet') continue

      const props = res.Properties
      if (!props?.Name || !props?.Type || !props?.HostedZoneId) continue

      // Skip records with intrinsic function references (like DKIM records
      // that use Fn::GetAtt for the Name - those are dynamic)
      if (typeof props.Name !== 'string') continue
      if (typeof props.HostedZoneId !== 'string') continue

      route53Records.push({
        logicalId,
        name: props.Name.endsWith('.') ? props.Name : `${props.Name}.`,
        type: props.Type,
        hostedZoneId: props.HostedZoneId,
      })
    }

    if (route53Records.length === 0) return

    // Get resources currently managed by the stack
    const managedResources = new Set<string>()
    try {
      const stackResources = await cfn.listStackResources(stackName)
      const summaries = (stackResources as any).StackResourceSummaries || []
      for (const r of summaries) {
        managedResources.add(r.LogicalResourceId)
      }
    } catch {
      // Stack might not exist yet - all records would be orphaned
    }

    // Check each record: if it exists in Route53 but ISN'T managed by the stack, delete it
    const route53 = new Route53Client(region)

    for (const record of route53Records) {
      // If the stack already manages this resource, skip it
      if (managedResources.has(record.logicalId)) continue

      try {
        const existing = await route53.listResourceRecordSets({
          HostedZoneId: record.hostedZoneId,
          StartRecordName: record.name,
          StartRecordType: record.type,
          MaxItems: '1',
        })

        const recordSets = existing.ResourceRecordSets || []
        const match = recordSets.find(
          (rs: any) => rs.Name === record.name && rs.Type === record.type,
        )

        if (match) {
          console.log(`   🧹 Removing orphaned ${record.type} record: ${record.name}`)
          await route53.changeResourceRecordSets({
            HostedZoneId: record.hostedZoneId,
            ChangeBatch: {
              Comment: 'Remove orphaned record for CloudFormation re-creation',
              Changes: [{
                Action: 'DELETE',
                ResourceRecordSet: match,
              }],
            },
          })
        }
      } catch (error: any) {
        // Non-fatal: if we can't clean up, the deploy will fail with the original error
        console.log(`   ⚠ Could not check/clean record ${record.name}: ${error.message}`)
      }
    }
  } catch {
    // Template parsing failed or other non-fatal error - proceed with deploy
  }
}

/**
 * Clean up SES suppression list for configured email recipients
 *
 * Email addresses may get added to the suppression list due to bounces
 * during initial setup (e.g., before MX records are properly configured).
 * This removes them so email delivery works after infrastructure is deployed.
 */
async function cleanupSesSuppressionList(
  cloudConfig: CloudConfig,
  region: string,
): Promise<void> {
  try {
    const emailConfig = cloudConfig.infrastructure?.email as any
    if (!emailConfig) return

    const domain = emailConfig.domain || cloudConfig.infrastructure?.dns?.domain
    if (!domain) return

    // Check common mailbox addresses for suppression
    const mailboxes = emailConfig.mailboxes || []
    const commonAddresses = [
      `chris@${domain}`,
      `blake@${domain}`,
      `glenn@${domain}`,
      `admin@${domain}`,
      `noreply@${domain}`,
      `test@${domain}`,
      ...mailboxes,
    ]

    // Deduplicate
    const addresses = [...new Set(commonAddresses)]

    const ses = new SESClient(region)
    for (const address of addresses) {
      try {
        const suppressed = await ses.getSuppressedDestination(address)
        if (suppressed) {
          console.log(`   🧹 Removing ${address} from SES suppression list (was: ${suppressed.Reason})`)
          await ses.deleteSuppressedDestination(address)
        }
      } catch {
        // Non-fatal - address might not be suppressed
      }
    }
  } catch {
    // Non-fatal - suppression list cleanup is best-effort
  }
}
