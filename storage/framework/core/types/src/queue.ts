import type { JobOptions } from './cron-jobs'
import type { DeepPartial } from './utils'

export interface QueueOptions {
  default: 'sync' | 'database' | 'redis' | 'sqs'
  connections: {
    sync: {
      driver: 'sync'
    }
    database: {
      driver: 'database'
      table: 'jobs'
      queue: 'default'
      retry_after: 90
    }
    redis: {
      driver: 'redis'
      connection: 'default'
      queue: 'default'
      retry_after: 90
    }
    sqs: {
      driver: 'sqs'
      key: ''
      secret: ''
      prefix: ''
      suffix: ''
      queue: 'default'
      region: 'us-east-1'
    }
  }
  failed: {
    driver: 'database'
    database: 'mysql'
    table: 'failed_jobs'
  }
}

export interface QueueOption extends JobOptions {
  delay?: number
}

export type QueueConfig = DeepPartial<QueueOptions>
