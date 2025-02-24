import type { Err, Ok } from '@stacksjs/error-handling'
import type { JobOptions } from '@stacksjs/types'
import { ok } from '@stacksjs/error-handling'
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
        executeJobRate(jobName, job.rate)
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

function executeJobRate(jobName: string, rate: string): void {
  switch (rate) {
    case Every.Minute:
      schedule.job(jobName).everyMinute()
      break
    case Every.TwoMinutes:
      schedule.job(jobName).everyTwoMinutes()
      break
    case Every.FiveMinutes:
      schedule.job(jobName).everyFiveMinutes()
      break
    case Every.TenMinutes:
      schedule.job(jobName).everyTenMinutes()
      break
    case Every.ThirtyMinutes:
      schedule.job(jobName).everyThirtyMinutes()
      break
    case Every.HalfHour:
      schedule.job(jobName).everyThirtyMinutes()
      break
    case Every.Hour:
      schedule.job(jobName).everyHour()
      break
    case Every.Day:
      schedule.job(jobName).everyDay()
      break
    case Every.Week:
      schedule.job(jobName).weekly()
      break
    case Every.Month:
      schedule.job(jobName).monthly()
      break
    case Every.Year:
      schedule.job(jobName).yearly()
      break
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
