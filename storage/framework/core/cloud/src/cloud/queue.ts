import type { Cluster, TaskDefinition } from 'aws-cdk-lib/aws-ecs'
import { aws_ec2 as ec2 } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import { pascalCase, slug } from '@stacksjs/strings'
import { fs } from '@stacksjs/storage'
import { path } from '@stacksjs/path'
import { Rule, Schedule } from 'aws-cdk-lib/aws-events'
import { EcsTask } from 'aws-cdk-lib/aws-events-targets'
import type { NestedCloudProps } from '../types'

export interface QueueStackProps extends NestedCloudProps {
  cluster: Cluster
  taskDefinition: TaskDefinition
}

export class QueueStack {
  scope: Construct
  props: QueueStackProps

  constructor(scope: Construct, props: QueueStackProps) {
    this.scope = scope
    this.props = props
  }

  async init() {
    const jobsDir = path.jobsPath()

    try {
      const files = await fs.readdir(jobsDir)

      for (const file of files) {
        if (file.endsWith('.ts')) {
          const filePath = path.jobsPath(file)

          // Await the loading of the job module
          const jobModule = await this.loadJobModule(filePath)

          // Now you can safely access jobModule.default.rate
          const rate = jobModule.default.rate || '* * * * *'

          // Rest of your logic here...
          // Convert the rate to a Schedule object
          const schedule = Schedule.cron(this.cronScheduleFromRate(rate))

          const id = `QueueRule${pascalCase(file.replace('.ts', ''))}`
          // Perform operations with the jobModule.default as needed
          const rule = new Rule(this.scope, id, {
            // schedule to run every second
            ruleName: `${this.props.appName}-${this.props.appEnv}-queue-rule-${slug(file.replace('.ts', ''))}`,
            schedule,
          })

          rule.addTarget(new EcsTask({
            cluster: this.props.cluster,
            taskDefinition: this.props.taskDefinition,
            containerOverrides: [
              {
                containerName: `${this.props.appName}-${this.props.appEnv}-api`,
                environment: [
                  {
                    name: 'QUEUE_WORKER',
                    value: 'true',
                  },
                  {
                    name: 'JOB',
                    value: file,
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
    }
    catch (err) {
      console.error('Error reading the jobs directory:', err)
    }
  }

  // Helper function to convert a rate string to a cron object for AWS Schedule
  cronScheduleFromRate(rate: string): { minute?: string, hour?: string, month?: string, weekDay?: string, year?: string } {
    // Assuming the rate is in standard cron format, split it to map to the AWS Schedule.cron() parameters
    const parts = rate.split(' ')
    return {
      minute: parts[0],
      hour: parts[1],
      month: parts[2],
      weekDay: parts[3],
      year: parts[4],
    }
  }

  async loadJobModule(filePath: string) {
    const jobModule = await import(filePath)

    return jobModule
  }
}
