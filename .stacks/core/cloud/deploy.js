#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { app as a, services as s } from '@stacksjs/config'
import { projectPath } from '@stacksjs/path'
import { loadEnv } from '@stacksjs/env'
import { StacksCloud } from './src/cloud.js'

const app = new cdk.App()
const cloudName = `stacks-cloud`
const env = loadEnv('development', projectPath(), '')

let account = env.AWS_ACCOUNT_ID;
let region = env.AWS_DEFAULT_REGION;

if (!account || !region) {
  console.error('Missing accountId or region in config.')
  process.exit(1)
}

let bucketName = `stacks-cloud-assets-${a.env}-${account}-${region}`;

// eslint-disable-next-line no-new
new StacksCloud(app, cloudName, {
  description: 'This stack includes all of your Stacks cloud resources.',
  env: {
    account,
    region,
    ...env
  },
  synthesizer: new cdk.DefaultStackSynthesizer({
    qualifier: a.env,
    fileAssetsBucketName: bucketName,
    // bootstrapBucketName: bucketName,
  }),
})
