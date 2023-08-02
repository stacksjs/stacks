import { type StackProps } from 'aws-cdk-lib'
import { type Construct } from 'constructs'
import { Stack } from 'aws-cdk-lib'
import { DnsStack } from '@stacksjs/dns'

export class CloudStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    // eslint-disable-next-line no-new
    new DnsStack(this, 'Nested1')
  }
}
