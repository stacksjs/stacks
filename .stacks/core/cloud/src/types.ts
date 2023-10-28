import type { AppEnvType } from '@stacksjs/types'
import type { NestedStackProps, StackProps, aws_certificatemanager as acm, aws_cloudfront as cloudfront, aws_route53 as route53, aws_s3 as s3, aws_wafv2 as wafv2 } from 'aws-cdk-lib'

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

export interface CloudOptions {
  env: {
    account: string
    region: string
  }
  name: string
  appEnv: AppEnvType
  domain: string
  partialAppKey: string
}
