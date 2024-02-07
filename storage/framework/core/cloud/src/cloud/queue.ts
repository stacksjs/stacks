import type { Cluster, TaskDefinition } from 'aws-cdk-lib/aws-ecs'
import { aws_ec2 as ec2 } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
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
  constructor(scope: Construct, props: QueueStackProps) {
    // Read all files in the jobs directory
    const jobsDir = path.appPath('Jobs')

    fs.readdir(jobsDir, (err, files) => {
      if (err) {
        console.error('Error reading the jobs directory:', err)
        return
      }

      // Loop through each file in the directory
      files.forEach((file) => {
        if (file.endsWith('.ts')) {
        // Construct the full path to the job file
          const filePath = path.join(jobsDir, file)

          // Import the job module
          const jobModule = await import(filePath)

          // Extract the rate from the job module, fallback to a default if not specified
          const rate = jobModule.rate || '* * * * *' // Default to every minute if not specified

          // Convert the rate to a Schedule object
          const schedule = Schedule.cron(cronScheduleFromRate(rate))

          // Assuming each job exports a Job instance as default, you can now access it
          // console.log('Loaded job:', jobModule.default.name)

          // Perform operations with the jobModule.default as needed
          const rule = new Rule(scope, `QueueRule${file}`, {
          // schedule to run every second
            ruleName: `${props.appName}-${props.appEnv}-queue-rule-${file}`,
            schedule,
          })
          // const rule = new Rule(scope, 'QueueRule', {
          //   // schedule to run every second
          //   ruleName: `${props.appName}-${props.appEnv}-queue-rule`,
          //   schedule: Schedule.cron({ minute: '*', hour: '*', month: '*', weekDay: '*', year: '*' }),
          // })

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
      })
    })
  }
}

// Helper function to convert a rate string to a cron object for AWS Schedule
function cronScheduleFromRate(rate: string): { minute?: string, hour?: string, month?: string, weekDay?: string, year?: string } {
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
