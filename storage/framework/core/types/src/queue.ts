import type { JobOptions } from './cron-jobs'
import type { DeepPartial } from './utils'

/**
 * Queue driver type
 */
export type QueueDriver = 'sync' | 'database' | 'redis' | 'sqs' | 'memory'

/**
 * Job status
 */
export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused'

/**
 * Log level for queue operations
 */
export type QueueLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

/**
 * Rate limiter configuration
 */
export interface QueueRateLimiter {
  /** Maximum number of jobs to process */
  max: number
  /** Duration in milliseconds */
  duration: number
  /** Key prefix for rate limiting */
  keyPrefix?: string | ((data: any) => string)
}

/**
 * Backoff configuration for job retries
 */
export interface QueueBackoff {
  /** Backoff type */
  type: 'fixed' | 'exponential'
  /** Delay in milliseconds */
  delay: number
}

/**
 * Dead letter queue configuration
 */
export interface DeadLetterQueueConfig {
  /** Enable dead letter queue */
  enabled?: boolean
  /** Suffix for dead letter queue name */
  queueSuffix?: string
  /** Maximum retries before moving to dead letter queue */
  maxRetries?: number
  /** Automatically process failed jobs */
  processFailed?: boolean
  /** Remove from original queue's failed list */
  removeFromOriginalQueue?: boolean
}

/**
 * Horizontal scaling configuration
 */
export interface HorizontalScalingConfig {
  /** Enable horizontal scaling */
  enabled?: boolean
  /** Instance identifier */
  instanceId?: string
  /** Maximum workers per instance */
  maxWorkersPerInstance?: number
  /** Jobs per worker */
  jobsPerWorker?: number
  /** Leader election configuration */
  leaderElection?: {
    heartbeatInterval?: number
    leaderTimeout?: number
  }
  /** Work coordination configuration */
  workCoordination?: {
    pollInterval?: number
    keyPrefix?: string
  }
}

/**
 * Metrics configuration
 */
export interface QueueMetricsConfig {
  /** Enable metrics collection */
  enabled: boolean
  /** Collection interval in milliseconds */
  collectInterval?: number
}

/**
 * Redis connection configuration for queue
 */
export interface QueueRedisConfig {
  /** Redis URL */
  url?: string
  /** Redis host */
  host?: string
  /** Redis port */
  port?: number
  /** Redis password */
  password?: string
  /** Redis database number */
  db?: number
  /** Key prefix */
  prefix?: string
}

/**
 * Job options for queue operations
 */
export interface QueueJobOptions {
  /** Delay in milliseconds before processing */
  delay?: number
  /** Number of retry attempts */
  attempts?: number
  /** Backoff configuration */
  backoff?: QueueBackoff
  /** Remove job on completion */
  removeOnComplete?: boolean | number
  /** Remove job on failure */
  removeOnFail?: boolean | number
  /** Job priority (higher = processed first) */
  priority?: number
  /** Process in LIFO order */
  lifo?: boolean
  /** Job timeout in milliseconds */
  timeout?: number
  /** Custom job ID */
  jobId?: string
  /** Job dependencies */
  dependsOn?: string | string[]
  /** Keep jobs in history */
  keepJobs?: boolean
  /** Dead letter queue options */
  deadLetter?: boolean | DeadLetterQueueConfig
  /** Repeat configuration for recurring jobs */
  repeat?: {
    /** Repeat every N milliseconds */
    every?: number
    /** Maximum number of repeats */
    limit?: number
    /** Cron expression */
    cron?: string
    /** Timezone */
    tz?: string
    /** Start date */
    startDate?: Date | number
    /** End date */
    endDate?: Date | number
  }
}

/**
 * Redis driver connection configuration
 */
export interface RedisConnectionConfig {
  driver: 'redis'
  /** Redis configuration */
  redis?: QueueRedisConfig
  /** Key prefix for queue keys */
  prefix?: string
  /** Default job options */
  defaultJobOptions?: QueueJobOptions
  /** Rate limiter configuration */
  limiter?: QueueRateLimiter
  /** Metrics configuration */
  metrics?: QueueMetricsConfig
  /** Stalled job check interval in milliseconds */
  stalledJobCheckInterval?: number
  /** Maximum stalled job retries */
  maxStalledJobRetries?: number
  /** Enable distributed locking */
  distributedLock?: boolean
  /** Default dead letter queue options */
  defaultDeadLetterOptions?: DeadLetterQueueConfig
  /** Horizontal scaling configuration */
  horizontalScaling?: HorizontalScalingConfig
  /** Log level */
  logLevel?: QueueLogLevel
  /** Worker concurrency */
  concurrency?: number
}

/**
 * Database driver connection configuration
 */
export interface DatabaseConnectionConfig {
  driver: 'database'
  /** Database table name */
  table?: string
  /** Queue name */
  queue?: string
  /** Retry after seconds */
  retryAfter?: number
}

/**
 * SQS driver connection configuration
 */
export interface SqsConnectionConfig {
  driver: 'sqs'
  /** AWS access key */
  key?: string
  /** AWS secret key */
  secret?: string
  /** Queue URL prefix */
  prefix?: string
  /** Queue URL suffix */
  suffix?: string
  /** Queue name */
  queue?: string
  /** AWS region */
  region?: string
}

/**
 * Sync driver connection configuration
 */
export interface SyncConnectionConfig {
  driver: 'sync'
}

/**
 * Memory driver connection configuration
 */
export interface MemoryConnectionConfig {
  driver: 'memory'
  /** Maximum queue size */
  maxSize?: number
}

/**
 * Queue connection configuration
 */
export type QueueConnectionConfig =
  | RedisConnectionConfig
  | DatabaseConnectionConfig
  | SqsConnectionConfig
  | SyncConnectionConfig
  | MemoryConnectionConfig

export interface Dispatchable {
  dispatch: () => Promise<void>
  dispatchNow: () => Promise<void>
  delay: (seconds: number) => this
  afterResponse: () => this
  chain: (jobs: Dispatchable[]) => this
  onQueue: (queue: string) => this
}

export interface QueueOptions {
  /** Default queue driver */
  default: QueueDriver
  /** Queue connections */
  connections: {
    sync?: SyncConnectionConfig
    database?: DatabaseConnectionConfig
    redis?: RedisConnectionConfig
    sqs?: SqsConnectionConfig
    memory?: MemoryConnectionConfig
    [key: string]: QueueConnectionConfig | undefined
  }
  /** Failed jobs configuration */
  failed: {
    driver: 'database' | 'redis'
    database?: string
    table?: string
    prefix?: string
  }
  /** Batching configuration */
  batching?: {
    driver: 'database' | 'redis'
    table?: string
    prefix?: string
  }
  /** Worker configuration */
  worker?: {
    /** Number of concurrent workers */
    concurrency?: number
    /** Graceful shutdown timeout in milliseconds */
    shutdownTimeout?: number
  }
}

export interface QueueOption extends JobOptions {
  delay?: number
  payload?: any
  afterResponse?: any
  context?: string
  maxTries?: number
  chainedJobs?: Dispatchable[]
  /** Queue name to dispatch to */
  queue?: string
  /** Job priority */
  priority?: number
  /** Backoff configuration */
  backoff?: number[] | QueueBackoff
  /** Job timeout */
  timeout?: number
  /** Immediate execution */
  immediate?: boolean
}

export type QueueConfig = DeepPartial<QueueOptions>

/**
 * Queue presets for common configurations
 */
export const QueuePresets = {
  /**
   * Development preset - uses sync driver
   */
  development: {
    default: 'sync' as const,
    connections: {
      sync: { driver: 'sync' as const },
    },
    failed: {
      driver: 'database' as const,
      table: 'failed_jobs',
    },
  },

  /**
   * Production preset - uses Redis with bun-queue
   */
  production: {
    default: 'redis' as const,
    connections: {
      redis: {
        driver: 'redis' as const,
        prefix: 'stacks:queue',
        concurrency: 5,
        distributedLock: true,
        metrics: { enabled: true },
        defaultDeadLetterOptions: {
          enabled: true,
          maxRetries: 3,
        },
      },
    },
    failed: {
      driver: 'redis' as const,
      prefix: 'stacks:failed',
    },
    worker: {
      concurrency: 5,
      shutdownTimeout: 30000,
    },
  },

  /**
   * High performance preset - optimized for throughput
   */
  highPerformance: {
    default: 'redis' as const,
    connections: {
      redis: {
        driver: 'redis' as const,
        prefix: 'stacks:queue',
        concurrency: 20,
        distributedLock: true,
        metrics: { enabled: true, collectInterval: 5000 },
        horizontalScaling: {
          enabled: true,
          maxWorkersPerInstance: 20,
          jobsPerWorker: 50,
        },
        defaultDeadLetterOptions: {
          enabled: true,
          maxRetries: 5,
        },
      },
    },
    failed: {
      driver: 'redis' as const,
      prefix: 'stacks:failed',
    },
    worker: {
      concurrency: 20,
      shutdownTimeout: 60000,
    },
  },

  /**
   * Database preset - uses database driver
   */
  database: {
    default: 'database' as const,
    connections: {
      database: {
        driver: 'database' as const,
        table: 'jobs',
        queue: 'default',
        retryAfter: 90,
      },
    },
    failed: {
      driver: 'database' as const,
      table: 'failed_jobs',
    },
  },
} as const
