import type { Result } from '@stacksjs/error-handling'
import type { JobOptions } from '@stacksjs/types'
import type { SchedulableJobName } from './schedule'
import { ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { path } from '@stacksjs/path'
import { schedule } from '@stacksjs/scheduler'
import { globSync } from '@stacksjs/storage'

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
      //
      // And it is the FILE name. A job may declare a `name` of its own - the
      // scaffold's ExampleJob says 'Example Job' - and scheduling under that
      // left an app/Scheduler.ts entry for `schedule.job('ExampleJob')`
      // unrecognised, so the job ran twice. The file name is what
      // `schedule.job()` is typed against; the declared one is checked too.
      const jobName = getJobName(jobFile)

      if (!job.rate)
        continue

      const scheduledAs = [jobName, job.name].find(name => typeof name === 'string' && schedule.isScheduled(name))
      if (scheduledAs) {
        log.debug(`[scheduler] ${scheduledAs} is declared in app/Scheduler.ts; ignoring its \`rate\` so it is not scheduled twice`)
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
      log.error(`[scheduler] could not schedule ${jobFile}: ${error instanceof Error ? error.message : String(error)}`)
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

/**
 * Schedule a job on its declared `rate`.
 *
 * This used to be a switch over eleven of the eighteen `Every` values, which
 * threw for the rest: `Every.FifteenMinutes`, `Weekday`, `Weekend`, the four
 * seconds rates, and any cron string written out by hand - `rate` is typed as
 * a string. The throw was caught per job and printed, so the job simply never
 * ran. `cron()` takes all of them, and refuses only what cannot be scheduled.
 */
function executeJobRate(jobName: SchedulableJobName, rate: string): void {
  schedule.job(jobName).cron(rate)
}

function getJobName(jobPath: string): string {
  const baseName = path.basename(jobPath)

  return baseName.replace(/\.ts$/, '')
}
