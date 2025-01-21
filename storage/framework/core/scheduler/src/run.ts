import type { JobOptions } from '@stacksjs/types'
import { type Err, ok, type Ok } from '@stacksjs/error-handling'
import { path } from '@stacksjs/path'
import { schedule } from '@stacksjs/scheduler'
import { globSync } from '@stacksjs/storage'
import { snakeCase } from '@stacksjs/strings'
import { Every } from '@stacksjs/types'

export async function runScheduler(): Promise<Ok<string, never> | Err<string, any>> {
  const jobFiles = globSync([path.appPath('Jobs/*.ts')], { absolute: true })

  // Process job files and initialize schedules if missing
  for (const jobFile of jobFiles) {
    try {
      const jobModule = await import(jobFile)
      const job = jobModule.default as JobOptions
      const jobName = snakeCase(getJobName(job, jobFile))

      if (job.rate)
        schedule.job(jobName).at(job.rate)
    }
    catch (error) {
      console.error(error)
    }
  }

  await runSchedulerInstance()

  return ok('Schedules ran successfully')
}

async function runSchedulerInstance(): Promise<void> {
  const schedulerFile = path.appPath('Scheduler.ts')
  const scheduleInstance = await import(schedulerFile)

  scheduleInstance.default()
}

export function getJobInterval(rate: string): number {
  switch (rate) {
    case Every.Minute:
      return 1
    case Every.TwoMinutes:
      return 2
    case Every.FiveMinutes:
      return 5
    case Every.TenMinutes:
      return 10
    case Every.FifteenMinutes:
      return 15
    case Every.ThirtyMinutes:
      return 30
    case Every.HalfHour:
      return 30
    case Every.Hour:
      return 60
    case Every.Day:
      return 60 * 24 // 1 day
    case Every.Week:
      return 60 * 24 * 7 // 1 week
    case Every.Month:
      return 60 * 24 * 30 // Approximate 1 month (30 days)
    case Every.Year:
      return 60 * 24 * 365 // Approximate 1 year (365 days)
    default:
      throw new Error(`Unsupported rate: ${rate}`)
  }
}

function getJobName(job: JobOptions, jobPath: string): string {
  if (job.name)
    return job.name

  const baseName = path.basename(jobPath)

  return baseName.replace(/\.ts$/, '')
}
