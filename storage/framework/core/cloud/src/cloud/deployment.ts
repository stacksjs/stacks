import { config } from '@stacksjs/config'
import { path as p } from '@stacksjs/path'
import { hasFiles } from '@stacksjs/storage'
import { docsSourceHash, websiteSourceHash } from '@stacksjs/utils'
import type { aws_cloudfront as cloudfront, aws_s3 as s3 } from 'aws-cdk-lib'
import { AssetHashType, aws_s3_deployment as s3deploy } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'

export interface DeploymentStackProps extends NestedCloudProps {
  publicBucket: s3.Bucket
  docsBucket?: s3.Bucket
  privateBucket: s3.Bucket
  cdn: cloudfront.Distribution
}

export class DeploymentStack {
  privateSource: string
  docsSource: string
  publicSource: string

  constructor(scope: Construct, props: DeploymentStackProps) {
    // following paths are relative to where the command is run from
    this.privateSource = '../../private'
    this.docsSource = '../docs/dist/'
    this.publicSource = config.app.docMode === true ? this.docsSource : '../views/web/dist/'

    new s3deploy.BucketDeployment(scope, 'Website', {
      sources: [
        s3deploy.Source.asset(this.publicSource, {
          assetHash: websiteSourceHash(),
          assetHashType: AssetHashType.CUSTOM,
        }),
      ],
      destinationBucket: props.publicBucket,
      distribution: props.cdn,
      distributionPaths: ['/*'],
    })

    // if docs should be deployed, add it to the deployment
    if (this.shouldDeployDocs()) {
      new s3deploy.BucketDeployment(scope, 'Docs', {
        sources: [
          s3deploy.Source.asset(this.docsSource, {
            assetHash: docsSourceHash(),
            assetHashType: AssetHashType.CUSTOM,
          }),
        ],
        destinationBucket: props.docsBucket as s3.Bucket,
        distribution: props.cdn,
        distributionPaths: ['/docs/*'],
      })
    }

    new s3deploy.BucketDeployment(scope, 'PrivateFiles', {
      sources: [s3deploy.Source.asset(this.privateSource)],
      destinationBucket: props.privateBucket,
    })
  }

  shouldDeployDocs() {
    return hasFiles(p.projectPath('docs')) && !config.app.docMode
  }
}
