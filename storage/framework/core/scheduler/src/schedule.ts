import type { DateTime } from 'luxon'
import { log, runCommand } from '@stacksjs/cli'
import { CronJob, CronTime } from './'

export class Schedule {
  private cronPattern = ''
  private timezone = 'America/Los_Angeles'
  private readonly task: () => void
  // private cmd?: string

  constructor(task: () => void) {
    this.task = task
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

  onDays(days: number[]): Schedule {
    const dayPattern = days.join(',')
    this.cronPattern = `0 0 0 * * ${dayPattern}`
    return this
  }

  // between(startTime: string, endTime: string) {
  //   // This method is a placeholder. Actual implementation will vary based on requirements.
  //   // Cron does not directly support "between" times without additional logic.
  //   console.warn('The "between" method is not directly supported by cron patterns and requires additional logic.')
  //   return this
  // }

  at(time: string): Schedule {
    // Assuming time is in "HH:MM" format
    const [hour, minute] = time.split(':').map(Number)
    this.cronPattern = `${minute} ${hour} * * *`
    return this
  }

  setTimeZone(timezone: string): Schedule {
    this.timezone = timezone
    return this
  }

  start(): void {
    // eslint-disable-next-line no-new
    new CronJob(this.cronPattern, this.task, null, true, this.timezone)
    log.info(`Scheduled task with pattern: ${this.cronPattern} in timezone: ${this.timezone}`)
  }

  // job and action methods need to be added and they accept a path string param
  job(path: string): Schedule {
    log.info(`Scheduling job: ${path}`)
    return this
  }

  action(path: string): Schedule {
    log.info(`Scheduling action: ${path}`)
    return this
  }

  static command(cmd: string): Schedule {
    log.info(`Executing command: ${cmd}`)
    return new Schedule(async () => {
      log.info(`Executing command: ${cmd}`)

      const result = await runCommand(cmd)

      if (result.isErr()) {
        log.error(result.error)
        return
      }

      log.info(result.value)
    })
  }
}

export class Job extends Schedule {}

export function sendAt(cronTime: string | Date | DateTime): DateTime {
  return new CronTime(cronTime).sendAt()
}

export function timeout(cronTime: string | Date | DateTime): number {
  return new CronTime(cronTime).getTimeout()
}

export type Scheduler = typeof Schedule

export default Schedule
