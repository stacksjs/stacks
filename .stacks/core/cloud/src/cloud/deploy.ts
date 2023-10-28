/* eslint-disable no-new */
import { NestedStack, RemovalPolicy, Tags, aws_backup as backup, aws_iam as iam, aws_s3 as s3, aws_s3_deployment as s3deploy } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { NestedCloudProps } from './index'

export class StorageStack extends NestedStack {
  constructor(scope: Construct, props: NestedCloudProps) {
    super(scope, 'Deploy', props)

    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset(this.websiteSource)],
      destinationBucket: props.publicBucket,
      distribution: props.cdn,
      distributionPaths: ['/*'],
    })
  }
}
