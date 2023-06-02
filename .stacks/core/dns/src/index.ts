import type { Construct, NestedStackProps } from '@aws-cdk/core'
import { NestedStack } from '@aws-cdk/core'
import * as route53 from '@aws-cdk/aws-route53'
import { app } from '@stacksjs/config'

export class DnsStack extends NestedStack {
  constructor(scope: Construct, id: string, props?: NestedStackProps) {
    super(scope, id, props)

    if (!app.url)
      throw new Error('./config app.url is not defined')

    // eslint-disable-next-line no-new
    new route53.PublicHostedZone(this, 'HostedZone', {
      zoneName: app.url,
    })
  }
}
