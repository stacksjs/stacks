import process from 'node:process'
import { log } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { env } from '@stacksjs/env'
import { slug as slugify } from '@stacksjs/strings'
import { ExitCode } from '@stacksjs/types'
import { App } from 'aws-cdk-lib'
import 'source-map-support/register'
import { Cloud } from '../core/cloud/src/cloud'
import { getOrCreateTimestamp } from '../core/cloud/src/helpers'
import type { CloudOptions } from '../core/cloud/src/types'

const app = new App()
const appEnv =
  (config.app.env as string) === 'local'
    ? 'dev'
    : (config.app.env as string) === 'development'
      ? 'dev'
      : (config.app.env as string) === 'staging'
        ? 'stage'
        : (config.app.env as string) === 'production'
          ? 'prod'
          : config.app.env

const appKey = config.app.key
const domain = config.app.url
const appName = config.app.name?.toLowerCase() ?? 'stacks'
const slug = slugify(appName)
const name = `${slug}-cloud`
const account = env.AWS_ACCOUNT_ID
// const region = env.AWS_DEFAULT_REGION
const region = 'us-east-1' // currently, us-east-1 is the only fully-supported region
let timestamp

if (!appKey) {
  log.info('Please set an application key. You may need to run `buddy key:generate`.')
  process.exit(ExitCode.InvalidArgument)
}

const parts = appKey.split(':')
if (parts && parts.length < 2)
  throw new Error(
    'Invalid format application key format. Expected a colon-separated string. You may need to run `buddy key:generate`.',
  )

if (!account || !region)
  throw new Error('Stacks is missing your accountId or region. Please ensure it is set in your .env file')

if (!domain) throw new Error('Missing app.url in config.')

if (!appName) throw new Error('Missing app.name in config.')

if (!config.team || Object.keys(config.team).length === 0)
  throw new Error(
    'Your ./config team needs to at least have one member defined. Please set yourself as a team member and try deploying again.',
  )

const usEnv = {
  account,
  region,
}

try {
  timestamp = await getOrCreateTimestamp()
} catch (error) {
  console.error('Error fetching timestamp', error)
  process.exit(ExitCode.FatalError)
}

export const options = {
  env: usEnv,
  name,
  slug,
  appEnv: appEnv ?? 'dev',
  appName,
  domain,
  timestamp,
} satisfies CloudOptions

const cloud = new Cloud(app, name, {
  ...options,
  description: `The Stacks Cloud`,
})

await cloud.init()

app.synth()
