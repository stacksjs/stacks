import type { Result } from '@stacksjs/error-handling'
import type { JobOptions } from '@stacksjs/types'
import type { SchedulableJobName } from './schedule'
import { ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { path } from '@stacksjs/path'
import { schedule } from '@stacksjs/scheduler'
import { globSync } from '@stacksjs/storage'
import { Every } from '@stacksjs/types'

export async function runScheduler(): Promise<Result<string, string>> {
  const jobFiles = globSync([path.appPath('Jobs/*.ts')], { absolute: true })

  // `app/Scheduler.ts` runs FIRST, before the `rate` fields are read.
  //
  // Both are sources of schedules, and a job that declared `rate: Every.Hour`
  // and also appeared in Scheduler.ts used to be registered twice - two cron
  // tasks, two runs, every hour, with nothing in the logs to say why the digest
  // went out in duplicate. Loading the explicit file first lets it win: only an
  // entry there can carry a timezone, an overlap policy or an `at()` time,
  // which is exactly the case where the two disagree.
  await runSchedulerInstance()

  // Process job files and initialize schedules if missing
  for (const jobFile of jobFiles) {
    try {
      const jobModule = await import(jobFile)
      const job = jobModule.default as JobOptions
      // The name has to survive intact: it is what `runJob` resolves back to a
      // FILE, `app/Jobs/<name>.ts`. Snake-casing it turned `Inspire` into
      // `inspire`, which resolves on a developer's case-insensitive macOS disk
      // and on nothing else — so every rate-scheduled job in every app worked
      // locally and failed on the server, once an hour, forever, in a log line
      // nobody was watching. Found in a dispensary's production journal:
      // `Job inspire not found. Looked in app/Jobs/inspire.ts`, beside
      // `app/Jobs/Inspire.ts`.
      const jobName = getJobName(job, jobFile)

      if (!job.rate)
        continue

      if (schedule.isScheduled(jobName)) {
        log.debug(`[scheduler] ${jobName} is declared in app/Scheduler.ts; ignoring its \`rate\` so it is not scheduled twice`)
        continue
      }

      /*
       * `jobName` comes from reading the jobs directory, so it is a string
       * here - every name it can hold IS a schedulable one, since the union is
       * derived from that same directory.
       */
      executeJobRate(jobName as SchedulableJobName, job.rate)
    }
    catch (error) {
      console.error(error)
    }
  }

  return ok('Schedules ran successfully')
}

async function runSchedulerInstance(): Promise<void> {
  const schedulerFile = path.appPath('Scheduler.ts')

  try {
    const scheduleInstance = await import(schedulerFile)

    if (typeof scheduleInstance.default === 'function') {
      scheduleInstance.default()
    }
    else {
      console.warn(`Scheduler file ${schedulerFile} does not export a default function`)
    }
  }
  catch (error) {
    console.warn(`Could not load scheduler file ${schedulerFile}:`, error)
  }
}

function executeJobRate(jobName: SchedulableJobName, rate: string): void {
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
