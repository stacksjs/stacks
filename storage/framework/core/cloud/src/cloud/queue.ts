import { SecretValue, aws_scheduler as scheduler } from 'aws-cdk-lib'
import { Rule, Schedule } from 'aws-cdk-lib/aws-events'
import { EcsTask } from 'aws-cdk-lib/aws-events-targets'
import type { Cluster, TaskDefinition } from 'aws-cdk-lib/aws-ecs'
import type { Construct } from 'constructs'
import { config } from '@stacksjs/config'
import { string } from '@stacksjs/strings'
import { env } from '@stacksjs/env'
import type { NestedCloudProps } from '../types'

export interface QueueStackProps extends NestedCloudProps {
  cluster: Cluster
  taskDefinition: TaskDefinition
}

export class QueueStack {
  constructor(scope: Construct, props: QueueStackProps) {
    const rule = new Rule(scope, 'Rule', {
      schedule: Schedule.cron({ minute: '0', hour: '0' }), // For example, every day at midnight
    })

    rule.addTarget(new EcsTask({
      cluster: props.cluster,
      taskDefinition: props.taskDefinition,
      containerOverrides: [
        {
          containerName: `${props.appName}-${props.appEnv}-api`,
          environment: [
            {
              name: 'QUEUE_WORKER',
              value: 'true',
            },
            {
              name: 'JOB',
              value: 'DummyJob',
            },
          ],
        },
      ],
      retryAttempts: 3,
    }))
  }
}
