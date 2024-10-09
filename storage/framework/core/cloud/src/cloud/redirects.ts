import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'
import { config } from '@stacksjs/config'
import { RemovalPolicy, aws_route53 as route53, aws_s3 as s3 } from 'aws-cdk-lib'

export interface RedirectsStackProps extends NestedCloudProps {
  //
}

export class RedirectsStack {
  redirectZones: route53.IHostedZone[] = []

  constructor(scope: Construct, props: RedirectsStackProps) {
    // for each redirect, create a bucket & redirect it to the APP_URL
    config.dns.redirects?.forEach((redirect: string) => {
      // TODO: use string-ts function here instead
      const slug = redirect
        .split('.')
        .map((part: string, index: number) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
        .join('') // creates a CamelCase slug from the redirect
      const hostedZone = route53.HostedZone.fromLookup(scope, 'HostedZone', {
        domainName: redirect,
      })

      const redirectBucket = new s3.Bucket(scope, `RedirectBucket${slug}`, {
        bucketName: `${redirect}-redirect`,
        websiteRedirect: {
          hostName: props.domain,
          protocol: s3.RedirectProtocol.HTTPS,
        },
        removalPolicy: RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      })

      new route53.CnameRecord(scope, `RedirectRecord${slug}`, {
        zone: hostedZone,
        recordName: 'redirect',
        domainName: redirectBucket.bucketWebsiteDomainName,
      })
    })

    // TODO: fix this – redirects do not work yet
    config.dns.redirects?.forEach((redirect: string) => {
      const slug = redirect
        .split('.')
        .map((part: string, index: number) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
        .join('') // creates a CamelCase slug from the redirect
      const hostedZone = route53.HostedZone.fromLookup(scope, `RedirectHostedZone${slug}`, { domainName: redirect })
      this.redirectZones.push(hostedZone)
    })
  }
}
