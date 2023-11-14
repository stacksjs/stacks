/* eslint-disable no-new */
import process from 'node:process'
import { config } from '@stacksjs/config'
import { ExitCode } from '@stacksjs/types'
import { env } from '@stacksjs/env'
import { App } from 'aws-cdk-lib'
import { Cloud } from './src/cloud'
import { getOrCreateTimestamp } from './src/helpers'
import type { CloudOptions } from './src/types'

const app = new App()
const appEnv = config.app.env === 'local' ? 'dev' : config.app.env
const appKey = config.app.key
const domain = config.app.url
const name = `stacks-cloud-${appEnv}`
const appName = config.app.name?.toLowerCase()
const account = env.AWS_ACCOUNT_ID
const region = env.AWS_DEFAULT_REGION
let timestamp

if (!appKey) {
  log.info('Please set an application key. `buddy key:generate` is your friend, in this case.')
  process.exit(ExitCode.InvalidArgument)
}

const parts = appKey.split(':')
if (parts && parts.length < 2)
  throw new Error('Invalid format application key format. Expected a colon-separated string. You may need to run `buddy key:generate`.')

if (!account || !region)
  throw new Error('Missing accountId or region in config.')

if (!domain)
  throw new Error('Missing app.url in config.')

if (!appName)
  throw new Error('Missing app.name in config.')

if (!config.team || Object.keys(config.team).length === 0)
  throw new Error('Your ./config team needs to at least have one member defined. Please set yourself as a team member and try deploying again.')

const usEnv = {
  account,
  region,
}

try {
  timestamp = await getOrCreateTimestamp()
}
catch (error) {
  console.error('Error fetching timestamp', error)
  process.exit(ExitCode.FatalError)
}

export const options = {
  env: usEnv,
  name,
  appEnv: appEnv ?? 'dev',
  appName,
  domain,
  timestamp,
} satisfies CloudOptions

new Cloud(app, name, {
  ...options,
  description: `Stacks Cloud ${appEnv} deployment`,
})

app.synth()
