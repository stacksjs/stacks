import type { Construct, StackProps } from '@aws-cdk/core'
import { Stack } from '@aws-cdk/core'
import { DnsStack } from '@stacksjs/dns'

export class ParentStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    // eslint-disable-next-line no-new
    new DnsStack(this, 'Nested1')
  }
}
