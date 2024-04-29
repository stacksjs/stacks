import { config } from '@stacksjs/config'
import {
  Duration,
  CfnOutput as Output,
  aws_iam as iam,
  aws_lambda as lambda,
} from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'

export interface AiStackProps extends NestedCloudProps {}

export class AiStack {
  askAiUrl: lambda.FunctionUrl
  summarizeAiUrl: lambda.FunctionUrl

  constructor(scope: Construct, props: AiStackProps) {
    // Define the Lambda Layer for aws-sdk
    const awsSdkLayer = new lambda.LayerVersion(scope, 'AwsSdkLayer', {
      code: lambda.Code.fromAsset('../core/cloud/src/cloud/aws-sdk-layer'), // path is relative to frameworkCloudPath()
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Layer with aws-sdk',
    })

    const bedrockAccessPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: config.ai.models?.map(
        (model) => `arn:aws:bedrock:us-east-1::foundation-model/${model}`,
      ),
    })

    const bedrockAccessRole = new iam.Role(scope, 'BedrockAccessRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    })

    bedrockAccessRole.addToPolicy(bedrockAccessPolicy)

    const askAi = new lambda.Function(scope, 'AskAiFunction', {
      functionName: `${props.slug}-${props.appEnv}-ai-ask`,
      description: 'Lambda function to invoke the AI model',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../core/cloud/src/cloud/lambda/ask'), // path is relative to frameworkCloudPath()
      layers: [awsSdkLayer],
      role: bedrockAccessRole,
      timeout: Duration.seconds(30),
    })

    this.askAiUrl = new lambda.FunctionUrl(scope, 'AskAiFunctionUrl', {
      function: askAi,
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['*'],
      },
    })

    const summarizeAi = new lambda.Function(scope, 'SummarizeAiFunction', {
      functionName: `${props.slug}-${props.appEnv}-ai-summarize`,
      description: 'Lambda function to summarize any given text',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../core/cloud/src/cloud/lambda/summarize'), // path is relative to frameworkCloudPath()
      layers: [awsSdkLayer],
      role: bedrockAccessRole,
      timeout: Duration.seconds(30),
    })

    this.summarizeAiUrl = new lambda.FunctionUrl(
      scope,
      'SummarizeAiFunctionUrl',
      {
        function: summarizeAi,
        authType: lambda.FunctionUrlAuthType.NONE,
        cors: {
          allowedOrigins: ['*'],
        },
      },
    )

    new Output(scope, 'AiVanityAskApiUrl', {
      value: this.askAiUrl.url,
    })

    new Output(scope, 'AiVanitySummarizeApiUrl', {
      value: this.summarizeAiUrl.url,
    })

    new Output(scope, 'AiAskApiUrl', {
      value: `https://${props.domain}/ai/ask`,
    })

    new Output(scope, 'AiSummarizeApiUrl', {
      value: `https://${props.domain}/ai/summary`,
    })
  }
}
