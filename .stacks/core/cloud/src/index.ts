import * as cdk from 'aws-cdk-lib'

// import * as route53 from 'aws-cdk-lib/aws-route53'
import { AwsStack } from './lib/aws-stack'

// import type { defineDns } from '@stacksjs/config'

export async function AwsStackFunction(): Promise<void> {
//   const app = new cdk.App()
//   const stack = new cdk.Stack(app, 'StacksJsStack')

  //   const zone = new route53.PublicHostedZone(stack, 'StacksJsZone', {
  //     zoneName: 'stacksjs.dev',
  //   })

  const app = new cdk.App()
  new AwsStack(app, 'AwsStack', {
    // env: { account: '123456789012', region: 'us-east-1' },

  })

  app.synth()
//   console.log(dns)
}
