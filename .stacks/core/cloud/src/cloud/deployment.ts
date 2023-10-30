/* eslint-disable no-new */
import type { aws_cloudfront as cloudfront, aws_s3 as s3 } from 'aws-cdk-lib'
import { aws_s3_deployment as s3deploy } from 'aws-cdk-lib'
import { config } from '@stacksjs/config'
import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'

export interface DeploymentStackProps extends NestedCloudProps {
  publicBucket: s3.Bucket
  privateBucket: s3.Bucket
  cdn: cloudfront.Distribution
}

export class DeploymentStack {
  privateSource: string
  docsSource: string
  websiteSource: string

  constructor(scope: Construct, props: DeploymentStackProps) {
    this.privateSource = '../../../storage/private'
    this.docsSource = '../../../storage/framework/docs'
    this.websiteSource = config.app.docMode ? this.docsSource : '../../../storage/public'

    new s3deploy.BucketDeployment(scope, 'Website', {
      sources: [s3deploy.Source.asset(this.websiteSource)],
      destinationBucket: props.publicBucket,
      distribution: props.cdn,
      distributionPaths: ['/*'],
    })

    new s3deploy.BucketDeployment(scope, 'PrivateFiles', {
      sources: [s3deploy.Source.asset(this.privateSource)],
      destinationBucket: props.privateBucket,
    })
  }
}
