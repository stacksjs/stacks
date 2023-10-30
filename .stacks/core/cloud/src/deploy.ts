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
const appName = config.app.name?.toLowerCase()
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

export const options = {
  env: usEnv,
  name,
  appEnv: appEnv ?? 'dev',
  appName,
  domain,
  partialAppKey,
} satisfies CloudOptions

new Cloud(app, name, options)

app.synth()

// function isProductionEnv(env: string) {
//   return env === 'production' || env === 'prod'
// }

// export async function getExistingBucketNameByPrefix(prefix: string): Promise<string | undefined | null> {
//   const s3 = new S3({ region: 'us-east-1' })

//   try {
//     const response = await s3.send(new ListBucketsCommand({}))
//     const bucket = response.Buckets?.find(bucket => bucket.Name?.startsWith(prefix))

//     return bucket ? bucket.Name : null
//   }
//   catch (error) {
//     console.error('Error fetching buckets', error)
//     return `${prefix}-${partialAppKey}`
//   }
// }
