import type { aws_cloudfront as cloudfront, aws_s3 as s3 } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'
import { config } from '@stacksjs/config'
import { path as p } from '@stacksjs/path'
import { hasFiles } from '@stacksjs/storage'
import { docsSourceHash, websiteSourceHash } from '@stacksjs/utils'
import { AssetHashType, aws_s3_deployment as s3deploy } from 'aws-cdk-lib'

export interface DeploymentStackProps extends NestedCloudProps {
  publicBucket: s3.Bucket
  docsBucket?: s3.Bucket
  privateBucket: s3.Bucket
  mainDistribution: cloudfront.Distribution
  docsDistribution?: cloudfront.Distribution
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
    const mainBucket = config.app.docMode === true ? props.docsBucket : props.publicBucket

    new s3deploy.BucketDeployment(scope, 'Website', {
      sources: [
        s3deploy.Source.asset(this.publicSource, {
          assetHash: websiteSourceHash(),
          assetHashType: AssetHashType.CUSTOM,
        }),
      ],
      destinationBucket: mainBucket as s3.Bucket,
      distribution: props.mainDistribution,
      // distributionPaths: ['/*'],
    })

    if (this.shouldDeployDocs()) {
      // if docs should be deployed, add it to the deployment
      new s3deploy.BucketDeployment(scope, 'Docs', {
        sources: [
          s3deploy.Source.asset(this.docsSource, {
            assetHash: docsSourceHash(),
            assetHashType: AssetHashType.CUSTOM,
          }),
        ],
        destinationBucket: props.docsBucket as s3.Bucket,
        distribution: props.docsDistribution,
        // distributionPaths: ['/*'],
      })
    }

    if (hasFiles(this.privateSource)) {
      new s3deploy.BucketDeployment(scope, 'PrivateFiles', {
        sources: [s3deploy.Source.asset(this.privateSource)],
        destinationBucket: props.privateBucket,
      })
    }
    else {
      console.error(`The path ${this.privateSource} does not have any files`)
    }
  }

  shouldDeployDocs(): boolean {
    return hasFiles(p.projectPath('docs')) && !config.app.docMode
  }
}
