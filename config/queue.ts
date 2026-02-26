import type { QueueConfig } from '@stacksjs/types'
import { env } from '@stacksjs/env'

/**
 * **Queue Configuration**
 *
 * This configuration defines all of your queue options. Stacks supports multiple
 * queue drivers including sync (immediate execution), database, Redis (via bun-queue),
 * and SQS.
 *
 * The Redis driver (powered by bun-queue) offers advanced features like:
 * - Distributed locks for job processing
 * - Horizontal scaling with leader election
 * - Rate limiting
 * - Dead letter queues
 * - Job priorities
 * - Cron scheduling
 * - Metrics collection
 *
 * Because Stacks is fully-typed, you may hover any of the options below and the
 * definitions will be provided.
 */

// Helper to extract the queue driver with correct union type
const queueDriver = String(env.QUEUE_DRIVER || 'sync')
const failedDriver = String(env.QUEUE_FAILED_DRIVER || 'database')

export default {
  // Default queue driver: 'sync' | 'database' | 'redis' | 'sqs' | 'memory'
  default: queueDriver as 'sync' | 'database' | 'redis' | 'sqs' | 'memory',

  connections: {
    // Sync driver - executes jobs immediately (good for development)
    sync: {
      driver: 'sync',
    },

    // Database driver - stores jobs in the database
    database: {
      driver: 'database',
      table: 'jobs',
      queue: 'default',
      retryAfter: 90,
    },

    // Redis driver (powered by bun-queue) - high-performance Redis-backed queue
    redis: {
      driver: 'redis',
      // Redis connection settings
      redis: {
        url: String(env.REDIS_URL || ''),
        host: String(env.REDIS_HOST || 'localhost'),
        port: Number(env.REDIS_PORT || 6379),
        password: String(env.REDIS_PASSWORD || ''),
        db: Number(env.REDIS_DB || 0),
      },
      // Key prefix for all queue keys
      prefix: String(env.QUEUE_PREFIX || 'stacks:queue'),
      // Worker concurrency (number of jobs processed simultaneously)
      concurrency: Number(env.QUEUE_CONCURRENCY || 5),
      // Log level for queue operations
      logLevel: String(env.QUEUE_LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error' | 'silent',
      // Enable distributed locking for job processing
      distributedLock: true,
      // Stalled job check interval (ms)
      stalledJobCheckInterval: 30000,
      // Maximum retries for stalled jobs
      maxStalledJobRetries: 3,
      // Rate limiting configuration
      limiter: env.QUEUE_RATE_LIMIT_ENABLED ? {
        max: Number(env.QUEUE_RATE_LIMIT_MAX || 100),
        duration: Number(env.QUEUE_RATE_LIMIT_DURATION || 1000),
      } : undefined,
      // Metrics collection
      metrics: {
        enabled: Boolean(env.QUEUE_METRICS_ENABLED || false),
        collectInterval: 10000,
      },
      // Dead letter queue for failed jobs
      defaultDeadLetterOptions: {
        enabled: Boolean(env.QUEUE_DLQ_ENABLED ?? true),
        maxRetries: Number(env.QUEUE_DLQ_MAX_RETRIES || 3),
        queueSuffix: '-dead-letter',
      },
      // Horizontal scaling (for multi-instance deployments)
      horizontalScaling: env.QUEUE_HORIZONTAL_SCALING_ENABLED ? {
        enabled: true,
        maxWorkersPerInstance: Number(env.QUEUE_MAX_WORKERS || 10),
        jobsPerWorker: Number(env.QUEUE_JOBS_PER_WORKER || 10),
        leaderElection: {
          heartbeatInterval: 5000,
          leaderTimeout: 15000,
        },
      } : undefined,
      // Default job options
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: false,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    },

    // SQS driver - AWS Simple Queue Service
    sqs: {
      driver: 'sqs',
      key: String(env.AWS_ACCESS_KEY_ID || ''),
      secret: String(env.AWS_SECRET_ACCESS_KEY || ''),
      prefix: String(env.SQS_PREFIX || ''),
      suffix: String(env.SQS_SUFFIX || ''),
      queue: 'default',
      region: String(env.AWS_REGION || 'us-east-1'),
    },

    // Memory driver - in-memory queue (for testing)
    memory: {
      driver: 'memory',
      maxSize: 10000,
    },
  },

  // Failed jobs configuration
  failed: {
    driver: failedDriver as 'database' | 'redis',
    table: 'failed_jobs',
    prefix: 'stacks:failed',
  },

  // Batching configuration
  batching: {
    driver: 'redis',
    prefix: 'stacks:batches',
  },

  // Worker configuration
  worker: {
    concurrency: Number(env.QUEUE_WORKER_CONCURRENCY || 5),
    shutdownTimeout: 30000,
  },
} satisfies QueueConfig
