import { config } from '@stacksjs/config'
import { Duration, CfnOutput as Output, aws_iam as iam, aws_lambda as lambda } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'

export interface AiStackProps extends NestedCloudProps {}

export class AiStack {
  constructor(scope: Construct, props: AiStackProps) {
    const bedrockAccessPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: config.ai.models?.map((model) => `arn:aws:bedrock:us-east-1::foundation-model/${model}`),
    })

    const bedrockAccessRole = new iam.Role(scope, 'BedrockAccessRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')],
    })

    bedrockAccessRole.addToPolicy(bedrockAccessPolicy)
  }
}
