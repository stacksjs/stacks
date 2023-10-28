/* eslint-disable no-new */
import process from 'node:process'
import { config } from '@stacksjs/config'
import { env } from '@stacksjs/env'
import * as cdk from 'aws-cdk-lib'
import { Cloud } from './cloud/'

const app = new cdk.App()
const appEnv = config.app.env === 'local' ? 'dev' : config.app.env
const cloudName = `stacks-cloud-${appEnv}`
const account = env.AWS_ACCOUNT_ID
const region = env.AWS_DEFAULT_REGION

if (!account || !region) {
  console.error('Missing accountId or region in config.')
  process.exit(1)
}

const usEnv = {
  account,
  region,
}

new Cloud(app, cloudName, {
  env: usEnv,
})

app.synth()
