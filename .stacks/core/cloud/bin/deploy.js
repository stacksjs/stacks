#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { app as a, services as s } from '@stacksjs/config'
import { StacksCloud } from '../src/cloud.js'

const app = new cdk.App()
const cloudName = `${a.name ?? 'Stacks'}Cloud`

// eslint-disable-next-line no-new
new StacksCloud(app, cloudName, {
  description: 'This stack includes all of your Stacks cloud resources.',
  env: {
    account: s.aws?.accountId,
    region: s.aws?.defaultRegion,
  },
})
