import {
  Duration,
  CfnOutput as Output,
  aws_lambda as lambda,
} from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'

export interface CliStackProps extends NestedCloudProps {}

export class CliStack {
  cliSetupUrl: lambda.FunctionUrl

  constructor(scope: Construct, props: CliStackProps) {
    const cliSetupFunc = new lambda.Function(scope, 'CliSetupFunction', {
      functionName: `${props.slug}-${props.appEnv}-cli-setup`,
      description:
        'Lambda function that triggers setup script for a Stacks project',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../core/cloud/src/cloud/lambda/cli-setup'), // path relative to the cloud root package dir
      timeout: Duration.seconds(30),
    })

    // create a Lambda.FunctionUrl to be used in the CloudFront OriginRequestPolicy
    // this will be used to trigger the function
    this.cliSetupUrl = new lambda.FunctionUrl(scope, 'CliSetupFunctionUrl', {
      function: cliSetupFunc,
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['*'],
      },
    })

    new Output(scope, 'CliSetupVanityUrl', {
      value: `${this.cliSetupUrl.url}cli-setup`,
    })

    new Output(scope, 'CliSetupUrl', {
      value: `https://${props.domain}/install`,
      description: 'URL to trigger the CLI setup function',
    })

    // once deployed, need to create logic in the cdn origin request to check if the request is for the cli
    // if it is, then we need the to use the function url as the origin
    // if it is not, then we need don't adjust the origin
  }
}
