import process from 'node:process'
import * as cdk from 'aws-cdk-lib'
import { config } from '@stacksjs/config'
import { StacksCloud } from './src/cloud'

const app = new cdk.App()
const appEnv = config.app.env === 'local' ? 'dev' : config.app.env
const cloudName = `stacks-cloud-${appEnv}`
const account = Bun.env.AWS_ACCOUNT_ID
const region = Bun.env.AWS_DEFAULT_REGION

if (!account || !region) {
  console.error('Missing accountId or region in config.')
  process.exit(1)
}

// eslint-disable-next-line no-new
new StacksCloud(app, cloudName, {
  description: 'This stack includes all of your Stacks cloud resources.',
  env: {
    account,
    region,
  },
})
