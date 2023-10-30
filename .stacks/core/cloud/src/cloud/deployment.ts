/* eslint-disable no-new */
import {
  NestedStack,
  Stack,
  StackOutputs,
  aws_cloudfront as cloudfront,
  aws_s3 as s3,
  aws_s3_deployment as s3deploy,
} from 'aws-cdk-lib'
import { config } from '@stacksjs/config'
import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'

export class StorageStack extends NestedStack {
  constructor(scope: Construct, props: NestedCloudProps) {
    super(scope, 'Deploy', props)

    const bucketPrefix = `${props.appName}-${props.appEnv}`
    const privateSource = '../../../storage/private'
    const docsSource = '../../../storage/docs'
    const websiteSource = config.app.docMode ? docsSource : '../../../storage/public'
    const publicBucket = s3.Bucket.fromBucketName(this, 'PublicBucket', `${bucketPrefix}-${props.partialAppKey}`)
    const privateBucket = s3.Bucket.fromBucketName(this, 'PrivateBucket', `${bucketPrefix}-private-${props.partialAppKey}`)
    const distributionId = new StackOutputs(scope, 'MyStackOutputs', {
      stack: Stack.of(this),
    }).get('DistributionId')

    const cdn = cloudfront.Distribution.fromDistributionAttributes(this, 'CDN', {
      domainName: props.domain,
      distributionId,
    })

    new s3deploy.BucketDeployment(this, 'Website', {
      sources: [s3deploy.Source.asset(websiteSource)],
      destinationBucket: publicBucket,
      distribution: cdn,
      distributionPaths: ['/*'],
    })

    new s3deploy.BucketDeployment(this, 'PrivateFiles', {
      sources: [s3deploy.Source.asset(privateSource)],
      destinationBucket: privateBucket,
    })
  }
}
