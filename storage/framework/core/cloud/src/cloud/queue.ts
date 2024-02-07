import type { Cluster, TaskDefinition } from 'aws-cdk-lib'
import { aws_ec2 as ec2 } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import { Rule, Schedule } from 'aws-cdk-lib/aws-events'
import { EcsTask } from 'aws-cdk-lib/aws-events-targets'
import type { NestedCloudProps } from '../types'

export interface QueueStackProps extends NestedCloudProps {
  cluster: Cluster
  taskDefinition: TaskDefinition
}

export class QueueStack {
  constructor(scope: Construct, props: QueueStackProps) {
    const rule = new Rule(scope, 'QueueRule', {
      // schedule to run every second
      ruleName: `${props.appName}-${props.appEnv}-queue-rule`,
      schedule: Schedule.cron({ minute: '*', hour: '*', month: '*', weekDay: '*', year: '*' }),
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
              value: 'ExampleJob.ts',
            },
          ],
        },
      ],

      retryAttempts: 3,

      subnetSelection: {
        subnetType: ec2.SubnetType.PUBLIC, // SubnetType.PRIVATE_WITH_EGRESS
      },
    }))
  }
}
