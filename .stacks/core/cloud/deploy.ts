#!/usr/bin/env bun
import * as cdk from 'aws-cdk-lib'
import { env } from '@stacksjs/env'
import { StacksCloud } from './src/cloud.js'

// import { app as a } from '@stacksjs/config'

const app = new cdk.App()
const cloudName = 'stacks-cloud'
const account = env.AWS_ACCOUNT_ID
const region = env.AWS_DEFAULT_REGION
// const bucketName = `stacks-cloud-assets-${a.env}-${account}-${region}`

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
