/**
 * Cron Job Options.
 */
export interface JobOptions {
  /**
   * The name of the job.
   */
  name?: string
  run: string | Function
  schedule?: string
  description?: string
  timezone?: string
  tries?: number
  backoff?: number | number[]
  enabled?: boolean
}

// export type Job = JobOptions
// export type Jobs = Job[]
// export type CronJob = Job
// export type CronJobs = Jobs

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
