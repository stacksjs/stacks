/* eslint-disable no-new */
import { NestedStack, aws_s3_deployment as s3deploy } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'

export class StorageStack extends NestedStack {
  constructor(scope: Construct, props: NestedCloudProps) {
    super(scope, 'Deploy', props)

    new s3deploy.BucketDeployment(this, 'Website', {
      sources: [s3deploy.Source.asset(this.websiteSource)],
      destinationBucket: props.publicBucket,
      distribution: props.cdn,
      distributionPaths: ['/*'],
    })

    new s3deploy.BucketDeployment(this, 'PrivateFiles', {
      sources: [s3deploy.Source.asset(this.privateSource)],
      destinationBucket: props.privateBucket,
    })
  }
}
