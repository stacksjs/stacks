import type { IntRange } from '@stacksjs/scheduler'

/**
 * Cron Job Options.
 */
export interface JobOptions {
  /**
   * The name of the job.
   */
  name?: string

  handle?: string | Function
  action?: string
  description?: string
  queue?: string
  timezone?: string
  /**
   * Number of tries. Must be between 0 and 185.
   */
  tries?: IntRange<0, 185>
  backoff?: number | number[]
  rate?: string | Every
  enabled?: boolean
}

export type JobConfig = JobOptions
export type Job = JobOptions
export type Jobs = Job[]
export type CronJob = Job
export type CronJobs = Jobs

export enum Every {
  // Second = '* * * * * *',
  // FiveSeconds = '*/5 * * * * *',
  // TenSeconds = '*/10 * * * * *',
  // ThirtySeconds = '*/30 * * * * *',
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
