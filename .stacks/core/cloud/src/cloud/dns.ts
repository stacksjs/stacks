import { aws_route53 as route53 } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'

// export class DnsStack extends NestedStack {
export class DnsStack {
  zone: route53.IHostedZone

  constructor(scope: Construct, props: NestedCloudProps) {
    // lets see if the zone already exists because Buddy should have created it already
    this.zone = route53.PublicHostedZone.fromLookup(scope, 'AppUrlHostedZone', {
      domainName: props.domain,
    })
  }
}
