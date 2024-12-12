import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'
import { RemovalPolicy, aws_route53 as route53, aws_s3 as s3, aws_route53_targets as targets } from 'aws-cdk-lib'

export class DnsStack {
  zone: route53.IHostedZone

  constructor(scope: Construct, props: NestedCloudProps) {
    // lets see if the zone already exists because Buddy should have created it already
    this.zone = route53.PublicHostedZone.fromLookup(scope, 'AppUrlHostedZone', {
      domainName: props.domain,
    })

    // setup the www redirect
    // Create a bucket for www.yourdomain.com and configure it to redirect to yourdomain.com
    const wwwBucket = new s3.Bucket(scope, 'WwwBucket', {
      bucketName: `www.${props.domain}`,
      websiteRedirect: {
        hostName: props.domain,
        protocol: s3.RedirectProtocol.HTTPS,
      },
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })

    // Create a Route53 record for www.yourdomain.com
    new route53.ARecord(scope, 'WwwAliasRecord', {
      recordName: `www.${props.domain}`,
      zone: this.zone,
      target: route53.RecordTarget.fromAlias(new targets.BucketWebsiteTarget(wwwBucket)),
    })

    // TODO: this only needs to be created if Lemon Squeezy is being used
    // Create a Route53 record for www.yourdomain.com
    new route53.ARecord(scope, 'StoreAliasRecord', {
      recordName: `store.${props.domain}`,
      zone: this.zone,
      target: route53.RecordTarget.fromIpAddresses('137.66.37.136'),
    })
  }
}
