/**
 * Cron Job Options.
 */
export interface CronJobOptions {
  /**
   * The name of the cron job.
   */
  name?: string
  function: string
  schedule: string
  description?: string
  enabled?: boolean
  timezone?: string
  active?: boolean
}

export type CronJob = CronJobOptions
export type CronJobs = CronJob[]
