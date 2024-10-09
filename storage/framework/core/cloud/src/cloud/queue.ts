import type { Cluster, TaskDefinition } from 'aws-cdk-lib/aws-ecs'
import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'
import { path } from '@stacksjs/path'
import { fs } from '@stacksjs/storage'
import { pascalCase, slug } from '@stacksjs/strings'
import { aws_ec2 as ec2 } from 'aws-cdk-lib'
import { Rule, Schedule } from 'aws-cdk-lib/aws-events'
import { EcsTask } from 'aws-cdk-lib/aws-events-targets'

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

  async init(): Promise<void> {
    const jobsDir = path.jobsPath()
    const actionsDir = path.appPath('Actions')
    const ormActionDir = path.builtUserActionsPath('src')

    const jobFiles = await fs.readdir(jobsDir)
    const actionFiles = await fs.readdir(actionsDir)
    const ormActionFiles = await fs.readdir(ormActionDir)
    const jobs = []

    // then, need to loop through all app/Jobs/*.ts and create a rule for each, potentially overwriting the Schedule.ts jobs
    for (const file of jobFiles) {
      if (!file.endsWith('.ts'))
        continue

      const jobPath = path.jobsPath(file)

      // Await the loading of the job module
      const job = await this.loadModule(jobPath)
      this.createQueueRule(job, file)
      jobs.push(job)
    }

    for (const ormFile of ormActionFiles) {
      if (!ormFile.endsWith('.ts'))
        continue

      const ormActionPath = path.builtUserActionsPath(`src/${ormFile}`)

      // Await the loading of the job module
      const ormAction = await this.loadModule(ormActionPath)
      this.createQueueRule(ormAction, ormFile)
      jobs.push(ormAction)
    }

    for (const file of actionFiles) {
      if (!file.endsWith('.ts'))
        continue

      const actionPath = path.appPath(`Actions/${file}`)

      // Await the loading of the job module
      const action = await this.loadModule(actionPath)
      this.createQueueRule(action, file)
      jobs.push(action)
    }
  }

  // Helper function to convert a rate string to a cron object for AWS Schedule
  cronScheduleFromRate(rate: string): {
    minute?: string
    hour?: string
    month?: string
    weekDay?: string
    year?: string
  } {
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

  async loadModule(filePath: string): Promise<{ default: any }> {
    const jobModule = await import(filePath)

    return jobModule
  }

  // TODO: narrow any type -> jobs & actions are allowed
  createQueueRule(module: { default: any }, file: string): void {
    // Now you can safely access module.default.rate
    const rate = module.default?.rate

    // if no rate or job is disabled, no need to schedule, skip
    if (!rate || module.default?.enabled === false)
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

    rule.addTarget(
      new EcsTask({
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
                value: module.default?.backoffFactor,
              },
              {
                name: 'JOB_RETRIES',
                value: module.default?.tries,
              },
              {
                name: 'JOB_INITIAL_DELAY',
                value: module.default?.initialDelay,
              },
              {
                name: 'JOB_JITTER',
                value: module.default?.jitter,
              },
            ],
          },
        ],

        retryAttempts: 1, // we utilize a custom retry mechanism in the job itself
        // retryAttempts: module.default.tries || 3,

        subnetSelection: {
          subnetType: ec2.SubnetType.PUBLIC, // SubnetType.PRIVATE_WITH_EGRESS
        },
      }),
    )
  }
}
