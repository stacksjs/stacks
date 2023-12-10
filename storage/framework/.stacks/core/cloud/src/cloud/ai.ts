/* eslint-disable no-new */
import {
  CfnOutput as Output,
  aws_iam as iam,
  aws_lambda as lambda,
} from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import { config } from '@stacksjs/config'
import type { NestedCloudProps } from '../types'

export interface AiStackProps extends NestedCloudProps {
}

export class AiStack {
  constructor(scope: Construct, props: AiStackProps) {
    // Define the Lambda Layer for aws-sdk
    const awsSdkLayer = new lambda.LayerVersion(scope, 'AwsSdkLayer', {
      code: lambda.Code.fromAsset('src/cloud/aws-sdk-layer'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Layer with aws-sdk',
    })

    const aiRole = new iam.Role(scope, 'AiRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    })

    // Granting the Lambda permission to invoke the AI model
    aiRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: config.ai.models?.map(model => `arn:aws:bedrock:us-east-1:${props.env.account}:foundation-model/${model}`),
        effect: iam.Effect.ALLOW,
      }),
    )

    const aiLambda = new lambda.Function(scope, 'LambdaFunction', {
      functionName: `${props.slug}-${props.appEnv}-ai`,
      description: 'Lambda function to invoke the AI model',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('src/cloud/lambda'), // path relative to the cloud root package dir
      layers: [awsSdkLayer],
      role: aiRole,
    })

    const api = new lambda.FunctionUrl(scope, 'AiLambdaUrl', {
      function: aiLambda,
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['*'],
      },
    })

    new Output(scope, 'AiApiUrl', {
      value: api.url,
    })
  }
}
