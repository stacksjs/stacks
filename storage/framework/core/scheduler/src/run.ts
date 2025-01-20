import type { JobOptions } from '@stacksjs/types'
import { err, type Err, ok, type Ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { path } from '@stacksjs/path'
import { fs, globSync } from '@stacksjs/storage'
import { snakeCase } from '@stacksjs/strings'
import { Every } from '@stacksjs/types'

interface JobSchedule {
  jobName: string
  rate: string
  path: string
  nextRunTime: string | null
}

const scheduleFile = path.storagePath('framework/core/scheduler/src/schedules/jobSchedule.json')

export async function runScheduler(): Promise<Ok<string, never> | Err<string, any>> {
  const now = new Date()
  const schedules = loadSchedule()

  const jobFiles = globSync([path.appPath('Jobs/*.ts')], { absolute: true })

  // Process job files and initialize schedules if missing
  for (const jobFile of jobFiles) {
    try {
      const jobModule = await import(jobFile)
      const job = jobModule.default as JobOptions
      const jobName = snakeCase(getJobName(job, jobFile))

      if (job.rate) {
        const existingSchedule = schedules.find(schedule => schedule.jobName === jobName)

        if (!existingSchedule) {
          // Prefill: Set the initial nextRunTime based on job's rate and current time
          const intervalMinutes = getJobInterval(job.rate)
          const nextRunTime = new Date(now.getTime() + intervalMinutes * 60000).toISOString()

          schedules.push({
            jobName,
            rate: job.rate,
            nextRunTime, // Set nextRunTime here
            path: jobFile,
          })
        }
      }
    }
    catch (error) {
      log.error(error)
      return err(`Scheduler failed execute job: ${jobFile}`)
    }
  }

  // Process schedules and run jobs as needed
  for (const schedule of schedules) {
    const nextRunTime = new Date(schedule.nextRunTime || now.toISOString())
    const intervalMinutes = getJobInterval(schedule.rate)

    const isDue = isDueToRun(nextRunTime, now)

    if (isDue) {
      console.log(`Running job: ${schedule.jobName} at ${now.toISOString()}`)
      await runJob(schedule.path)

      // Refresh the next run time based on the interval
      schedule.nextRunTime = new Date(nextRunTime.getTime() + intervalMinutes * 60000).toISOString()
    }
  }

  // Save updated schedules
  saveSchedule(schedules)

  return ok('Schedules ran successfully')
}

function isDueToRun(nextRunTime: Date, currentDate: Date): boolean {
  return currentDate >= nextRunTime
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

// Mock function to simulate job execution
async function runJob(path: string): Promise<void> {
  const jobFile = await import(path)
  const job = jobFile.default as JobOptions

  if (job && typeof job.handle === 'function') {
    await job.handle()
  }
}

// Save the schedule to a file
function saveSchedule(schedule: JobSchedule[]): void {
  fs.writeFileSync(scheduleFile, JSON.stringify(schedule, null, 2))
}

function loadSchedule(): JobSchedule[] {
  if (!fs.existsSync(scheduleFile))
    return []
  return JSON.parse(fs.readFileSync(scheduleFile, 'utf-8'))
}

function getJobName(job: JobOptions, jobPath: string): string {
  if (job.name)
    return job.name

  const baseName = path.basename(jobPath)

  return baseName.replace(/\.ts$/, '')
}
