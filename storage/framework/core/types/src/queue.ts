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


export interface JobOptions {
  /** Queue to run the job on */
  queue?: string
  /** Data to be passed to the job */
  payload?: any
  /** Additional context for the job */
  context?: any
  /** Maximum number of retry attempts */
  maxTries?: number
  /** Timeout in seconds */
  timeout?: number
  /** Backoff timing between retries in seconds */
  backoff?: number[]
  /** Whether to execute immediately */
  immediate?: boolean
  /** Custom job options */
  [key: string]: any
}

export interface QueueOption extends JobOptions {
  delay?: number
}


export type QueueConfig = DeepPartial<QueueOptions>
