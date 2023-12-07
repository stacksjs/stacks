/* eslint-disable no-new */
import {
  aws_lambda as lambda,
  aws_apigateway as apigateway,
  aws_iam as iam,
  CfnOutput as Output,
} from 'aws-cdk-lib'
import type { Construct } from 'constructs'
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
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'ai-lambda.handler',
      code: lambda.Code.fromAsset('ai-lambda'),
      // layers: [awsSdkLayer],
    })

    const api = new apigateway.LambdaRestApi(scope, 'ApiGateway', {
      handler: aiLambda,
    })

    // Granting the Lambda permission to invoke the AI model
    aiLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-text-express-v1'],
    }))

    new Output(scope, 'AiApiUrl', {
      value: api.url,
    })
  }
}
