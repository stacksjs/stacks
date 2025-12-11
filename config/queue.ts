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
export default {
  // Default queue driver: 'sync' | 'database' | 'redis' | 'sqs' | 'memory'
  default: env.QUEUE_DRIVER || 'sync',

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
        url: env.REDIS_URL,
        host: env.REDIS_HOST || 'localhost',
        port: env.REDIS_PORT || 6379,
        password: env.REDIS_PASSWORD,
        db: env.REDIS_DB || 0,
      },
      // Key prefix for all queue keys
      prefix: env.QUEUE_PREFIX || 'stacks:queue',
      // Worker concurrency (number of jobs processed simultaneously)
      concurrency: env.QUEUE_CONCURRENCY || 5,
      // Log level for queue operations
      logLevel: env.QUEUE_LOG_LEVEL || 'info',
      // Enable distributed locking for job processing
      distributedLock: true,
      // Stalled job check interval (ms)
      stalledJobCheckInterval: 30000,
      // Maximum retries for stalled jobs
      maxStalledJobRetries: 3,
      // Rate limiting configuration
      limiter: env.QUEUE_RATE_LIMIT_ENABLED ? {
        max: env.QUEUE_RATE_LIMIT_MAX || 100,
        duration: env.QUEUE_RATE_LIMIT_DURATION || 1000,
      } : undefined,
      // Metrics collection
      metrics: {
        enabled: env.QUEUE_METRICS_ENABLED || false,
        collectInterval: 10000,
      },
      // Dead letter queue for failed jobs
      defaultDeadLetterOptions: {
        enabled: env.QUEUE_DLQ_ENABLED || true,
        maxRetries: env.QUEUE_DLQ_MAX_RETRIES || 3,
        queueSuffix: '-dead-letter',
      },
      // Horizontal scaling (for multi-instance deployments)
      horizontalScaling: env.QUEUE_HORIZONTAL_SCALING_ENABLED ? {
        enabled: true,
        maxWorkersPerInstance: env.QUEUE_MAX_WORKERS || 10,
        jobsPerWorker: env.QUEUE_JOBS_PER_WORKER || 10,
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
      key: env.AWS_ACCESS_KEY_ID || '',
      secret: env.AWS_SECRET_ACCESS_KEY || '',
      prefix: env.SQS_PREFIX || '',
      suffix: env.SQS_SUFFIX || '',
      queue: 'default',
      region: env.AWS_REGION || 'us-east-1',
    },

    // Memory driver - in-memory queue (for testing)
    memory: {
      driver: 'memory',
      maxSize: 10000,
    },
  },

  // Failed jobs configuration
  failed: {
    driver: env.QUEUE_FAILED_DRIVER || 'database',
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
    concurrency: env.QUEUE_WORKER_CONCURRENCY || 5,
    shutdownTimeout: 30000,
  },
} satisfies QueueConfig
