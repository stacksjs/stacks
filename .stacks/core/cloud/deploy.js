#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { app as a, services as s } from '@stacksjs/config'
import { projectPath } from '@stacksjs/path'
import { env, loadEnv } from '@stacksjs/env'
import { StacksCloud } from './src/cloud.js'

// console.log('env', )

const app = new cdk.App()
const cloudName = `stacks-cloud`
let accountId = env.AWS_ACCOUNT_ID;
let region = env.AWS_DEFAULT_REGION;

if (!accountId || !region) {
  console.log('Missing accountId or region in config, fetching from AWS')
  console.log('envenv', env)
  process.exit(1)
  // Fetch accountId and region here
}

let bucketName = `stacks-cloud-${a.env}-assets-${accountId}-${region}`;

console.log('env', process.env)

// eslint-disable-next-line no-new
new StacksCloud(app, cloudName, {
  // toolkitStackName: `${cloudName}-toolkit`,
  description: 'This stack includes all of your Stacks cloud resources.',
  env: {
    account: s.aws?.accountId,
    region: s.aws?.region,
    ...env
  },
  synthesizer: new cdk.DefaultStackSynthesizer({
    qualifier: a.env,
    fileAssetsBucketName: bucketName,
    bucketPrefix: '',
  }),
})
