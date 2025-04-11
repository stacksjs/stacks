import type { CatchCallbackFn, CronOptions } from '@stacksjs/cron'
import type { TimedSchedule, Timezone, UntimedSchedule } from './types'
import { runAction } from '@stacksjs/actions'
import { log, runCommand } from '@stacksjs/cli'
import { Cron } from '@stacksjs/cron'
import { runJob } from '@stacksjs/queue'

/**
 * This class is used to create and manage scheduled jobs. It provides methods for
 * defining the schedule pattern, timezone, error handling, and job protection.
 * @class Schedule
 * @implements {UntimedSchedule}
 * @example
 * ```typescript
 * import { schedule } from '@stacksjs/scheduler'
 *
 * schedule
 *   .job('my-job')
 *   .everyMinute()
 *   .withErrorHandler((error) => {
 *     console.error('Job failed:', error)
 *   })
 *   .withMaxRuns(10)
 *   .withProtection((job) => {
 *     console.log('Job is protected:', job)
 *   })
 *   .withName('my-job')
 *   .withContext({ key: 'value' })
 *   .withInterval(60)
 *   .between('2024-01-01', '2024-12-31')
 * ```
 */
export class Schedule implements UntimedSchedule {
  private static jobs = new Map<string, Cron>()
  private cronPattern = ''
  private timezone: Timezone = 'America/Los_Angeles'
  private readonly task: () => void
  private options: {
    timezone?: string
    catch?: CatchCallbackFn
    maxRuns?: number
    protect?: boolean | ((job: Cron) => void)
    name?: string
    context?: any
    interval?: number
    startAt?: string | Date
    stopAt?: string | Date
  } = {}

  constructor(task: () => void) {
    this.task = task
    // Start job automatically when constructor is called
    // We need to use setTimeout to ensure all chain methods are called first
    setTimeout(() => this.start(), 0)
  }

  everySecond(): TimedSchedule {
    this.cronPattern = '* * * * * *'
    return this as TimedSchedule
  }

  everyMinute(): TimedSchedule {
    this.cronPattern = '0 * * * * *'
    return this as TimedSchedule
  }

  everyTwoMinutes(): TimedSchedule {
    this.cronPattern = '*/2 * * * * *'
    return this as TimedSchedule
  }

  everyFiveMinutes(): TimedSchedule {
    this.cronPattern = '*/5 * * * *'
    return this as TimedSchedule
  }

  everyTenMinutes(): TimedSchedule {
    this.cronPattern = '*/10 * * * *'
    return this as TimedSchedule
  }

  everyThirtyMinutes(): TimedSchedule {
    this.cronPattern = '*/30 * * * *'
    return this as TimedSchedule
  }

  everyHour(): TimedSchedule {
    this.cronPattern = '0 0 * * * *'
    return this as TimedSchedule
  }

  everyDay(): TimedSchedule {
    this.cronPattern = '0 0 0 * * *'
    return this as TimedSchedule
  }

  hourly(): TimedSchedule {
    this.cronPattern = '0 0 * * * *'
    return this as TimedSchedule
  }

  daily(): TimedSchedule {
    this.cronPattern = '0 0 0 * * *'
    return this as TimedSchedule
  }

  weekly(): TimedSchedule {
    this.cronPattern = '0 0 0 * * 0'
    return this as TimedSchedule
  }

  monthly(): TimedSchedule {
    this.cronPattern = '0 0 0 1 * *'
    return this as TimedSchedule
  }

  yearly(): TimedSchedule {
    this.cronPattern = '0 0 0 1 1 *'
    return this as TimedSchedule
  }

  annually(): TimedSchedule {
    this.cronPattern = '0 0 0 1 1 *'
    return this as TimedSchedule
  }

  onDays(days: number[]): TimedSchedule {
    const dayPattern = days.join(',')
    this.cronPattern = `0 0 0 * * ${dayPattern}`
    return this as TimedSchedule
  }

  at(time: string): TimedSchedule {
    // Assuming time is in "HH:MM" format
    const [hour, minute] = time.split(':').map(Number)
    this.cronPattern = `${minute} ${hour} * * *`
    return this as TimedSchedule
  }

  setTimeZone(timezone: Timezone): this {
    this.timezone = timezone
    this.options.timezone = timezone
    return this
  }

  withErrorHandler(handler: CatchCallbackFn): this {
    this.options.catch = handler
    return this
  }

  withMaxRuns(runs: number): this {
    this.options.maxRuns = runs
    return this
  }

  withProtection(callback?: (job: Cron) => void): this {
    this.options.protect = callback || true
    return this
  }

  withName(name: string): this {
    this.options.name = name
    return this
  }

  withContext(context: any): this {
    this.options.context = context
    return this
  }

  withInterval(seconds: number): this {
    this.options.interval = seconds
    return this
  }

  between(startAt: string | Date, stopAt: string | Date): this {
    this.options.startAt = startAt
    this.options.stopAt = stopAt
    return this
  }

  private start(): Cron {
    const job = new Cron(
      this.cronPattern,
      {
        ...this.options,
        timezone: this.timezone,
      } as CronOptions,
      this.task,
    )

    if (this.options.name) {
      Schedule.jobs.set(this.options.name, job)
    }

    log.info(`Scheduled task with pattern: ${this.cronPattern} in timezone: ${this.timezone}`)
    return job
  }

  // job and action methods need to be added and they accept a path string param
  static job(name: string): UntimedSchedule {
    return new Schedule(async () => {
      log.info(`Running job: ${name}`)
      try {
        await runJob(name)
      }
      catch (error) {
        log.error(`Job ${name} failed:`, error)
        throw error // This will be caught by the error handler if one is set
      }
    }).withName(name) as UntimedSchedule
  }

  static action(name: string): UntimedSchedule {
    return new Schedule(async () => {
      log.info(`Running action: ${name}`)
      try {
        await runAction(name)
      }
      catch (error) {
        log.error(`Action ${name} failed:`, error)
        throw error
      }
    }).withName(name) as UntimedSchedule
  }

  static command(cmd: string): UntimedSchedule {
    return new Schedule(async () => {
      try {
        log.info(`Executing command: ${cmd}`)
        const result = await runCommand(cmd)

        if (result.isErr()) {
          log.error(result.error)
          throw result.error
        }
      }
      catch (error) {
        log.error(`Command execution failed: ${error}`)
        throw error
      }
    }).withName(`command-${cmd}`) as UntimedSchedule
  }

  /**
   * Gracefully shutdown all scheduled jobs.
   * This method should be called when the application is shutting down.
   * It will stop all running jobs and clear the jobs map.
   * @returns Promise<void>
   * @static
   * @memberof Schedule
   * @example
   * ```typescript
   * process.on('SIGINT', () => {
   *  schedule.gracefulShutdown().then(() => process.exit(0))
   * })
   */
  static async gracefulShutdown(): Promise<void> {
    log.info('Gracefully shutting down scheduled jobs...')

    const shutdownPromises = []

    for (const [name, job] of Schedule.jobs) {
      log.info(`Stopping job: ${name}`)
      shutdownPromises.push(
        new Promise<void>((resolve) => {
          job.stop()
          resolve()
        }),
      )
    }

    await Promise.all(shutdownPromises)
    Schedule.jobs.clear()

    log.info('All jobs have been stopped')
  }
}

export class Queue extends Schedule { }

export function sendAt(cronTime: string | Date): Date | null {
  const cron = new Cron(cronTime)
  return cron.nextRun()
}

export function timeout(cronTime: string | Date): number {
  const cron = new Cron(cronTime)
  const nextDate = cron.nextRun()

  if (!nextDate)
    return -1

  return nextDate.getTime() - Date.now()
}

export type Scheduler = typeof Schedule
export const schedule: Scheduler = Schedule

export default Schedule
