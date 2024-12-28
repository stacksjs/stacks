import type { CatchCallbackFn, CronOptions } from './'
import { log, runCommand } from '@stacksjs/cli'
import { Cron } from './'

export class Schedule {
  private static jobs = new Map<string, Cron>()

  private cronPattern = ''
  private timezone = 'America/Los_Angeles'
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

  everySecond(): Schedule {
    this.cronPattern = '* * * * * *'
    return this
  }

  everyMinute(): Schedule {
    this.cronPattern = '0 * * * * *'
    return this
  }

  everyTwoMinutes(): Schedule {
    this.cronPattern = '*/2 * * * * *'
    return this
  }

  everyFiveMinutes(): Schedule {
    this.cronPattern = '*/5 * * * *'
    return this
  }

  everyTenMinutes(): Schedule {
    this.cronPattern = '*/10 * * * *'
    return this
  }

  everyThirtyMinutes(): Schedule {
    this.cronPattern = '*/30 * * * *'
    return this
  }

  everyHour(): Schedule {
    this.cronPattern = '0 0 * * * *'
    return this
  }

  everyDay(): Schedule {
    this.cronPattern = '0 0 0 * * *'
    return this
  }

  hourly(): Schedule {
    this.cronPattern = '0 0 * * * *'
    return this
  }

  daily(): Schedule {
    this.cronPattern = '0 0 0 * * *'
    return this
  }

  weekly(): Schedule {
    this.cronPattern = '0 0 0 * * 0'
    return this
  }

  monthly(): Schedule {
    this.cronPattern = '0 0 0 1 * *'
    return this
  }

  yearly(): Schedule {
    this.cronPattern = '0 0 0 1 1 *'
    return this
  }

  annually(): Schedule {
    this.cronPattern = '0 0 0 1 1 *'
    return this
  }

  onDays(days: number[]): Schedule {
    const dayPattern = days.join(',')
    this.cronPattern = `0 0 0 * * ${dayPattern}`
    return this
  }

  at(time: string): Schedule {
    // Assuming time is in "HH:MM" format
    const [hour, minute] = time.split(':').map(Number)
    this.cronPattern = `${minute} ${hour} * * *`
    return this
  }

  setTimeZone(timezone: string): Schedule {
    this.timezone = timezone
    this.options.timezone = timezone
    return this
  }

  withErrorHandler(handler: CatchCallbackFn): Schedule {
    this.options.catch = handler
    return this
  }

  withMaxRuns(runs: number): Schedule {
    this.options.maxRuns = runs
    return this
  }

  withProtection(callback?: (job: Cron) => void): Schedule {
    this.options.protect = callback || true
    return this
  }

  withName(name: string): Schedule {
    this.options.name = name
    return this
  }

  withContext(context: any): Schedule {
    this.options.context = context
    return this
  }

  withInterval(seconds: number): Schedule {
    this.options.interval = seconds
    return this
  }

  between(startAt: string | Date, stopAt: string | Date): Schedule {
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
  static job(name: string): Schedule {
    return new Schedule(async () => {
      log.info(`Running job: ${name}`)
      try {
        await runCommand(`node path/to/jobs/${name}.js`)
      }
      catch (error) {
        log.error(`Job ${name} failed:`, error)
        throw error // This will be caught by the error handler if one is set
      }
    }).withName(name)
  }

  static action(name: string): Schedule {
    return new Schedule(async () => {
      log.info(`Running action: ${name}`)
      try {
        await runCommand(`node path/to/actions/${name}.js`)
      }
      catch (error) {
        log.error(`Action ${name} failed:`, error)
        throw error
      }
    }).withName(name)
  }

  static command(cmd: string): Schedule {
    return new Schedule(async () => {
      try {
        log.info(`Executing command: ${cmd}`)
        const result = await runCommand(cmd)

        if (result.isErr()) {
          log.error(result.error)
          throw result.error
        }

        log.info(result.value)
      }
      catch (error) {
        log.error(`Command execution failed: ${error}`)
        throw error
      }
    }).withName(`command-${cmd}`)
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

export class Job extends Schedule { }

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

export const schedule: typeof Schedule = Schedule

export type Scheduler = typeof Schedule

export default Schedule
