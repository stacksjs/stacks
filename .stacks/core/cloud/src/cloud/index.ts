/* eslint-disable no-new */
import type { Construct } from 'constructs'
import { Stack } from 'aws-cdk-lib'
import type { NestedStackProps, StackProps, aws_certificatemanager as acm, aws_cloudfront as cloudfront, aws_route53 as route53, aws_s3 as s3, aws_wafv2 as wafv2 } from 'aws-cdk-lib'
import { CdnStack } from './cdn'
import { DocsStack } from './docs'
import { StorageStack } from './storage'

export interface CloudProps extends StackProps {
  env: {
    account: string
    region: string
  }
  appName: string
  appEnv: string
  domain: string
  partialAppKey: string
  zone: route53.HostedZone
  certificate: acm.Certificate
  logBucket: s3.Bucket
  firewall: wafv2.CfnWebACL
  storage: {
    publicBucket: s3.Bucket
    accessPoint: s3.CfnAccessPoint | undefined
  }
  cdn: cloudfront.Distribution
}

export interface NestedCloudProps extends NestedStackProps {
  env: {
    account: string
    region: string
  }
  appName: string
  appEnv: string
  domain: string
  partialAppKey: string
  zone: route53.HostedZone
  certificate: acm.Certificate
  logBucket: s3.Bucket
  firewall: wafv2.CfnWebACL
  storage: {
    publicBucket: s3.Bucket
    accessPoint: s3.CfnAccessPoint | undefined
  }
  cdn: cloudfront.Distribution
}

export class Cloud extends Stack {
  constructor(scope: Construct, id: string, props: CloudProps) {
    super(scope, id, props)

    // please beware: be careful changing the order of the stacks creation below
    new StorageStack(this, props)
    new CdnStack(this, props)
    new DocsStack(this, props)
  }
}
