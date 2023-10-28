/* eslint-disable no-new */
import process from 'node:process'
import { config } from '@stacksjs/config'
import { env } from '@stacksjs/env'
import * as cdk from 'aws-cdk-lib'
import { Cloud } from './cloud/'
import type { CloudOptions } from './types'

const app = new cdk.App()
const appEnv = config.app.env === 'local' ? 'dev' : config.app.env
const appKey = config.app.key
const domain = config.app.url
const name = `stacks-cloud-${appEnv}`
const account = env.AWS_ACCOUNT_ID
const region = env.AWS_DEFAULT_REGION

if (!appKey) {
  log.info('Please set an application key. `buddy key:generate` is your friend, in this case.')
  process.exit(ExitCode.InvalidArgument)
}

const parts = appKey.split(':')
if (parts && parts.length < 2)
  throw new Error('Invalid format application key format. Expected a colon-separated string. You may need to run `buddy key:generate`.')

const partialAppKey = parts[1] ? parts[1].substring(0, 10).toLowerCase() : undefined

if (!partialAppKey)
  throw new Error('The application key seems to be missing. Please set it before deploying. `buddy key:generate` is your friend, in this case.')

if (!account || !region)
  throw new Error('Missing accountId or region in config.')

const usEnv = {
  account,
  region,
}

export const options = {
  env: usEnv,
  name,
  appEnv,
  domain,
  partialAppKey,
} satisfies CloudOptions

new Cloud(app, name, options)

app.synth()
