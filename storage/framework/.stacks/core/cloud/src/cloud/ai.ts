/* eslint-disable no-new */
import {
  CfnOutput as Output,
  aws_apigateway as apigateway,
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
    // // Define the Lambda Layer for aws-sdk
    // const awsSdkLayer = new lambda.LayerVersion(scope, 'AwsSdkLayer', {
    //   code: lambda.Code.fromAsset('aws-sdk-layer'),
    //   compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
    //   description: 'Layer with aws-sdk',
    // })

    // Defining the Node.js Lambda function
    const aiLambda = new lambda.Function(scope, 'LambdaFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda'),
      // layers: [awsSdkLayer],
    })

    const api = new apigateway.LambdaRestApi(scope, 'ApiGateway', {
      handler: aiLambda,
    })

    // Granting the Lambda permission to invoke the AI model
    aiLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: config.ai.models?.map(model => `arn:aws:bedrock:us-east-1:${props.env.account}:model/${model}`),
    }))

    new Output(scope, 'AiApiUrl', {
      value: api.url,
    })
  }
}
