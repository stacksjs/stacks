import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'
import { config } from '@stacksjs/config'
import { aws_iam as iam } from 'aws-cdk-lib'

export interface AiStackProps extends NestedCloudProps {}

export class AiStack {
  // eslint-disable-next-line unused-imports/no-unused-vars
  constructor(scope: Construct, props: AiStackProps) {
    const bedrockAccessPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: config.ai.models?.map((model: string) => `arn:aws:bedrock:us-east-1::foundation-model/${model}`),
    })

    const bedrockAccessRole = new iam.Role(scope, 'BedrockAccessRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')],
    })

    bedrockAccessRole.addToPolicy(bedrockAccessPolicy)
  }
}
