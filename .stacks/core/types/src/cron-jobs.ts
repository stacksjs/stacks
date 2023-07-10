/**
 * Cron Job Options.
 */
export interface JobOptions {
  /**
   * The name of the job.
   */
  name?: string
  action?: string | Function
  run?: string | Function
  schedule?: string
  description?: string
  enabled?: boolean
  timezone?: string
  active?: boolean
  tries?: number
  backoff?: number | number[]
}
export type Job = JobOptions
export type Jobs = Job[]

export interface CronJobOptions extends Omit<JobOptions, 'schedule'> {
  schedule: string
}
export type CronJob = CronJobOptions
export type CronJobs = CronJob[]

export enum Every {
  Second = '* * * * * *',
  FiveSeconds = '*/5 * * * * *',
  TenSeconds = '*/10 * * * * *',
  ThirtySeconds = '*/30 * * * * *',
  Minute = '* * * * *',
  Hour = '0 * * * *',
  HalfHour = '0,30 * * * *',
  Day = '0 0 * * *',
  Month = '0 0 1 * *',
  Week = '0 0 * * 0',
  Year = '0 0 1 1 *',
  FifthMinute = '*/5 * * * *',
  TenthMinute = '*/10 * * * *',
}
