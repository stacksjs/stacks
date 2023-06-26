/**
 * Cron Job Options.
 */
export interface CronJobOptions {
  /**
   * The name of the cron job.
   */
  name?: string
  action: string | Function
  schedule: string
  description?: string
  enabled?: boolean
  timezone?: string
  active?: boolean
}

export type CronJob = CronJobOptions
export type CronJobs = CronJob[]

export enum Every {
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
