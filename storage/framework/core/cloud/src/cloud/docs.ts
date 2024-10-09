import type { CfnResource } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'
import { config } from '@stacksjs/config'
import { path as p } from '@stacksjs/path'
import { storage } from '@stacksjs/storage'
import { originRequestFunctionHash } from '@stacksjs/utils'
import { AssetHashType, aws_lambda as lambda, CfnOutput as Output, RemovalPolicy } from 'aws-cdk-lib'

export interface DocsStackProps extends NestedCloudProps {
  //
}

export class DocsStack {
  originRequestFunction: lambda.Function

  constructor(scope: Construct, props: DocsStackProps) {
    // if docsPrefix is not set, then we know we are in docsMode and the documentation lives at the root of the domain
    const docsPrefix = 'docs'

    // this edge function ensures pretty docs urls
    // soon to be reused for our Meema features
    this.originRequestFunction = new lambda.Function(scope, 'OriginRequestFunction', {
      // this needs to have timestamp to ensure uniqueness. Since Origin Request (Lambda@Edge) functions are replicated functions, the
      // deletion process takes a "long time". This way, the function is always unique in cases of quick recreations.
      functionName: `${props.slug}-${props.appEnv}-origin-request-${props.timestamp}`,
      description: 'The Stacks Origin Request function that prettifies URLs by removing the .html extension',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'dist/origin-request.handler',
      code: lambda.Code.fromAsset(p.cloudPath('dist.zip'), {
        assetHash: originRequestFunctionHash(),
        assetHashType: AssetHashType.CUSTOM,
      }),
    })

    // applying this is a workaround for failing deployments due to the following DELETE_FAILED error:
    // > Resource handler returned message: "Lambda was unable to delete arn:aws:lambda:us-east-1:92330274019:function:stacks-cloud-production-OriginRequestFunction4FA39-XQadJcSWY8Lz:1 because it is a replicated function. Please see our documentation for Deleting Lambda@Edge Functions and Replicas. (Service: Lambda, Status Code: 400, Request ID: 83bd3112-aaa4-4980-bfcf-3ee2052a0435)" (RequestToken: c91aed31-1a62-9425-c25d-4fc0fccfa45f, HandlerErrorCode: InvalidRequest)
    // if we do not delete this resource, then it circumvents trying to delete the function and the deployment succeeds
    // buddy cloud:cleanup is what will be suggested running after user ensured no more sensitive data is in the buckets
    const cfnOriginRequestFunction = this.originRequestFunction.node.defaultChild as CfnResource
    cfnOriginRequestFunction.applyRemovalPolicy(RemovalPolicy.RETAIN)

    if (!config.app.docMode && storage.hasFiles(p.projectPath('docs'))) {
      new Output(scope, 'DocsUrl', {
        value: `https://${docsPrefix}.${props.domain}`,
        description: 'The URL of the deployed documentation',
      })
    }
  }
}
