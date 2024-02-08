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
      const jobFiles = await fs.readdir(jobsDir)
      const actionFiles = await fs.readdir(actionsDir)
      const jobs = []

      // then, need to loop through all app/Jobs/*.ts and create a rule for each, potentially overwriting the Schedule.ts jobs
      for (const file of jobFiles) {
        if (!file.endsWith('.ts'))
          continue

        const filePath = path.jobsPath(file)

        // Await the loading of the job module
        jobs.push(await this.loadModule(filePath))
      }

      for (const file of actionFiles) {
        if (!file.endsWith('.ts'))
          continue

        const filePath = path.actionsPath(file)

        // Await the loading of the job module
        jobs.push(await this.loadModule(filePath))
      }

      for (const job of jobs)
        await this.createQueueRule(job)
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

  async loadModule(filePath: string) {
    const jobModule = await import(filePath)

    return jobModule
  }

  createQueueRule(job: any) {
    // Now you can safely access job.default.rate
    const rate = job.default?.rate

    // if no rate or job is disabled, no need to schedule, skip
    if (!rate || job.default?.enabled === false)
      return

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
            {
              name: 'JOB_BACKOFF_FACTOR',
              value: jobModule.default?.backoffFactor,
            },
            {
              name: 'JOB_RETRIES',
              value: jobModule.default?.tries,
            },
            {
              name: 'JOB_INITIAL_DELAY',
              value: jobModule.default?.initialDelay,
            },
            {
              name: 'JOB_JITTER',
              value: jobModule.default?.jitter,
            },
          ],
        },
      ],

      retryAttempts: 1, // we utilize a custom retry mechanism in the job itself
      // retryAttempts: jobModule.default.tries || 3,

      subnetSelection: {
        subnetType: ec2.SubnetType.PUBLIC, // SubnetType.PRIVATE_WITH_EGRESS
      },
    }))
  }
}
