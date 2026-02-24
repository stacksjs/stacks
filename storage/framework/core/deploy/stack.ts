/**
 * Stack Deployment Module
 *
 * Handles full infrastructure stack deployment using ts-cloud CloudFormation.
 * Generates and deploys infrastructure based on cloud.config.ts
 */

import type { CloudConfig, EnvironmentType } from '@stacksjs/ts-cloud'
import { AWSCloudFormationClient as CloudFormationClient, InfrastructureGenerator } from '@stacksjs/ts-cloud'

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
    stackExists = stacks.length > 0
  } catch (error) {
    // Stack doesn't exist
    stackExists = false
  }

  if (stackExists) {
    console.log('   📦 Stack exists, updating...')

    try {
      const result = await cfn.updateStack({
        stackName: finalStackName,
        templateBody: template,
        capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
        tags: [
          { Key: 'Environment', Value: environment },
          { Key: 'Project', Value: cloudConfig.project.name },
          { Key: 'ManagedBy', Value: 'ts-cloud' },
        ],
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
      tags: [
        { Key: 'Environment', Value: environment },
        { Key: 'Project', Value: cloudConfig.project.name },
        { Key: 'ManagedBy', Value: 'ts-cloud' },
      ],
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
    const stacks = await cfn.describeStacks({ stackName: finalStackName })
    const stack = stacks[0]

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
    const stacks = await withRetry(
      () => cfn.describeStacks({ stackName }),
      { label: 'poll describeStacks' },
    )
    const stack = stacks[0]

    if (!stack) {
      throw new Error(`Stack ${stackName} not found`)
    }

    // Show recent events
    try {
      const events = await cfn.describeStackEvents(stackName)
      const recentEvent = events[0]

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
      const stacks = await withRetry(
        () => cfn.describeStacks({ stackName }),
        { label: 'poll delete describeStacks' },
      )
      const stack = stacks[0]

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
  const stacks = await cfn.describeStacks({ stackName })
  const stack = stacks[0]

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
