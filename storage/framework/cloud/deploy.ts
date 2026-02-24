import type { CloudConfig, EnvironmentType } from '@stacksjs/ts-cloud'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import { config, determineAppEnv } from '@stacksjs/config'
import { env } from '@stacksjs/env'
import { slug as slugify } from '@stacksjs/strings'
import { ExitCode } from '@stacksjs/types'
import { AWSCloudFormationClient as CloudFormationClient, InfrastructureGenerator } from '@stacksjs/ts-cloud'
import { tsCloud } from '~/config/cloud'

const appEnv = determineAppEnv()
const appKey = config.app.key
const domain = config.app.url
const appName = config.app.name?.toLowerCase() ?? 'stacks'
const slug = slugify(appName)
const region = env.AWS_REGION || 'us-east-1'

if (!appKey) {
  log.info('Please set an application key. You may need to run `buddy key:generate`.')
  process.exit(ExitCode.InvalidArgument)
}

const parts = appKey.split(':')
if (parts && parts.length < 2) {
  throw new Error(
    'Invalid format application key format. Expected a colon-separated string. You may need to run `buddy key:generate`.',
  )
}

if (!region) {
  throw new Error('Stacks is missing AWS region. Please ensure AWS_REGION is set in your .env file')
}

if (!domain)
  throw new Error('Missing app.url in config.')

if (!appName)
  throw new Error('Missing app.name in config.')

if (!config.team || Object.keys(config.team).length === 0) {
  throw new Error(
    'Your ./config team needs to at least have one member defined. Please set yourself as a team member and try deploying again.',
  )
}

const environment = (appEnv === 'local' ? 'development' : appEnv) || 'production'
const cloudConfig = tsCloud as CloudConfig

// Generate CloudFormation template using ts-cloud
const generator = new InfrastructureGenerator({
  config: cloudConfig,
  environment: environment as EnvironmentType,
})

const template = generator.generate().toJSON()
const stackName = `${slug}-cloud`

log.info(`Deploying ${stackName} to ${region} (${environment})...`)

const cfn = new CloudFormationClient(region)

// Check if stack exists and create/update accordingly
let stackExists = false
try {
  const result = await cfn.describeStacks({ stackName })
  stackExists = (result as Record<string, unknown[]>).Stacks?.length > 0
}
catch {
  stackExists = false
}

if (stackExists) {
  log.info('Stack exists, updating...')
  try {
    await cfn.updateStack({
      stackName,
      templateBody: template,
      capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
      tags: [
        { Key: 'Environment', Value: environment },
        { Key: 'Project', Value: appName },
        { Key: 'ManagedBy', Value: 'ts-cloud' },
      ],
    })
    log.info('Stack update initiated.')
  }
  catch (error: any) {
    if (error.message?.includes('No updates are to be performed')) {
      log.info('No changes detected - stack is up to date.')
    }
    else {
      throw error
    }
  }
}
else {
  log.info('Creating new stack...')
  await cfn.createStack({
    stackName,
    templateBody: template,
    capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
    tags: [
      { Key: 'Environment', Value: environment },
      { Key: 'Project', Value: appName },
      { Key: 'ManagedBy', Value: 'ts-cloud' },
    ],
    onFailure: 'ROLLBACK',
  })
  log.info('Stack creation initiated.')
}
