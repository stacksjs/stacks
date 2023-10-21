import { config } from '@stacksjs/config'
import { env } from '@stacksjs/env'
import * as cdk from 'aws-cdk-lib'
import process from 'node:process'
import { StacksCloud } from './src/cloud'

const app = new cdk.App()
const appEnv = config.app.env === 'local' ? 'dev' : config.app.env
// stacks-cloud-${appEnv}`
const cloudName = `stacks-cloud-${appEnv}`
const account = env.AWS_ACCOUNT_ID
const region = env.AWS_DEFAULT_REGION

if (!account || !region) {
  console.error('Missing accountId or region in config.')
  process.exit(1)
}

const cloud = new StacksCloud(app, 'StacksCloud', {
  stackName: cloudName,
  description: 'This stack includes all of your Stacks cloud resources.',
  env: {
    account,
    region,
  },
})

cloud.init()
