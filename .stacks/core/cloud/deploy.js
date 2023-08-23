#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { app as a, services as s } from '@stacksjs/config'
import { env } from '@stacksjs/env'
import { StacksCloud } from './src/cloud.js'

const app = new cdk.App()
const cloudName = `StacksCloud`

console.log('env', process.env)

// eslint-disable-next-line no-new
new StacksCloud(app, cloudName, {
  description: 'This stack includes all of your Stacks cloud resources.',
  env: {
    account: s.aws?.accountId,
    region: s.aws?.region,
    ...env
  },
  synthesizer: new cdk.DefaultStackSynthesizer({
    qualifier: a.env,
    fileAssetsBucketName: 'stacks-cloud-${Qualifier}-assets-${AWS::AccountId}-${AWS::Region}',
    bucketPrefix: '',
  }),
})
