/* eslint-disable no-new */
import {
  NestedStack,
  aws_route53 as route53,
} from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'

export class DnsStack extends NestedStack {
  constructor(scope: Construct, props: NestedCloudProps) {
    super(scope, 'Dns', props)

    // lets see if the zone already exists because Buddy should have created it already
    // const zone = route53.PublicHostedZone.fromLookup(this, 'AppUrlHostedZone', {
    //   domainName: props.domain,
    // })

    // TODO: fix this – redirects do not work yet
    // config.dns.redirects?.forEach((redirect) => {
    //   const slug = redirect.split('.').map((part, index) => index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)).join('') // creates a CamelCase slug from the redirect
    //   const hostedZone = route53.HostedZone.fromLookup(this, `RedirectHostedZone${slug}`, { domainName: redirect })
    //   this.redirectZones.push(hostedZone)
    // })
  }
}
