/* eslint-disable no-new */
import { Duration, CfnOutput as Output, aws_iam as iam, aws_lambda as lambda } from 'aws-cdk-lib'
import { AuthorizationType, LambdaIntegration, Resource, RestApi } from 'aws-cdk-lib/aws-apigateway'
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

    const bedrockAccessPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: config.ai.models?.map(model => `arn:aws:bedrock:us-east-1::foundation-model/${model}`),
    })

    const bedrockAccessRole = new iam.Role(scope, 'BedrockAccessRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    })

    bedrockAccessRole.addToPolicy(bedrockAccessPolicy)

    const askLambda = new lambda.Function(scope, 'AskAiFunction', {
      functionName: `${props.slug}-${props.appEnv}-ai-ask`,
      description: 'Lambda function to invoke the AI model',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('src/cloud/lambda/ask'), // path relative to the cloud root package dir
      layers: [awsSdkLayer],
      role: bedrockAccessRole,
      timeout: Duration.seconds(30),
    })

    const summarizeLambda = new lambda.Function(scope, 'AiFunction', {
      functionName: `${props.slug}-${props.appEnv}-ai-summarize`,
      description: 'Lambda function to summarize any given text',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('src/cloud/lambda/summarize'),
      layers: [awsSdkLayer],
      role: bedrockAccessRole,
      timeout: Duration.seconds(30),
    })

    const api = new RestApi(scope, 'AiRestApi', {
      restApiName: `${props.slug}-${props.appEnv}-ai`,
      description: 'Stacks AI API',
    })

    const askResource = api.root.addResource('ask')
    const askIntegration = new LambdaIntegration(askLambda)
    askResource.addMethod('POST', askIntegration, {
      operationName: 'Stacks AI Ask',
      authorizationType: AuthorizationType.NONE,
    })

    const summarizeResource = api.root.addResource('summarize')
    const summarizeIntegration = new LambdaIntegration(summarizeLambda)
    summarizeResource.addMethod('POST', summarizeIntegration, {
      operationName: 'Stacks AI Summarize',
      authorizationType: AuthorizationType.NONE,
    })

    // const api = new lambda.FunctionUrl(scope, 'AiLambdaUrl', {
    //   function: aiLambda,
    //   authType: lambda.FunctionUrlAuthType.NONE,
    //   cors: {
    //     allowedOrigins: ['*'],
    //   },
    // })

    new Output(scope, 'AiVanityApiUrl', {
      value: api.url,
    })

    new Output(scope, 'AiApiUrl', {
      value: `https://${props.domain}/ai/ask`,
    })
  }
}
