import type { IntRange } from '@stacksjs/cron'

export type Job = JobOptions
export type Jobs = Job[]
export type CronJob = Job
export type CronJobs = Jobs

export enum Every {
  Second = '* * * * * *',
  FiveSeconds = '*/5 * * * * *',
  TenSeconds = '*/10 * * * * *',
  ThirtySeconds = '*/30 * * * * *',
  Minute = '* * * * *',
  TwoMinutes = '*/2 * * * *',
  FiveMinutes = '*/5 * * * *',
  TenMinutes = '*/10 * * * *',
  FifteenMinutes = '*/15 * * * *',
  ThirtyMinutes = '*/30 * * * *',
  Hour = '0 * * * *',
  HalfHour = '0,30 * * * *',
  Day = '0 0 * * *',
  Week = '0 0 * * 0',
  Weekday = '0 0 * * 1-5',
  Weekend = '0 0 * * 0,6',
  Month = '0 0 1 * *',
  Year = '0 0 1 1 *',
}

export type JobHandler = (data?: any) => Promise<any> | any

/**
 * Represents different backoff strategies for job retries
 */
type BackoffStrategy = 'fixed' | 'exponential' | 'linear' | 'random'

export interface JitterConfig {
  /**
   * Enable/disable jitter
   */
  enabled: boolean
  /**
   * Maximum percentage of variation (0-1)
   */
  factor?: number
  /**
   * Minimum delay in milliseconds
   */
  minDelay?: number
  /**
   * Maximum delay in milliseconds
   */
  maxDelay?: number
}

export interface BackoffConfig {
  /**
   * The strategy to use for calculating delay between retries
   */
  strategy: BackoffStrategy
  /**
   * Initial delay in milliseconds
   */
  initialDelay: number
  /**
   * For exponential/linear backoff: the multiplier/increment to apply
   */
  factor?: number
  /**
   * Maximum delay between retries in milliseconds
   */
  maxDelay?: number
  /**
   * Jitter configuration to add randomness to delays
   */
  jitter?: JitterConfig
}

export interface JobOptions {
  /**
   * The name of the job
   */
  name?: string
  /**
   * Job handler function or identifier string
   */
  handle?: string | JobHandler
  /**
   * Action identifier
   */
  action?: string
  /**
   * Job description
   */
  description?: string
  /**
   * Queue name
   */
  queue?: string
  /**
   * Timezone for scheduling
   */
  timezone?: string
  /**
   * Number of retry attempts. Must be between 0 and 185
   */
  tries?: IntRange<0, 185>
  /**
   * Simple backoff configuration using delay values
   * Can be a single number for fixed delay,
   * or an array of delays for custom retry delays
   */
  backoff?: number | number[]
  /**
   * Advanced backoff configuration
   */
  backoffConfig?: BackoffConfig
  /**
   * Rate limiting configuration
   * Can be a string like "5/minute" or an Every object
   */
  rate?: string | Every
  /**
   * Whether the job is enabled
   */
  enabled?: boolean
  /**
   * Maximum execution time in milliseconds
   */
  timeout?: number
  /**
   * Unique job key to prevent duplicates
   */
  key?: string
  /**
   * Time-to-live in seconds for the job key
   */
  ttl?: number
  /**
   * Whether to run the job immediately when added
   */
  immediate?: boolean
  /**
   * Custom metadata for the job
   */
  meta?: Record<string, any>
}
