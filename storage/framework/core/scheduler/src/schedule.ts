/* eslint-disable no-new */
import { log } from '@stacksjs/cli'
import type { DateTime } from 'luxon'
import { CronTime } from './time'

export class Schedule {
  private cronPattern: string = ''
  private timezone: string = 'America/Los_Angeles'
  private readonly task: () => void
  // private cmd?: string

  constructor(task: () => void) {
    this.task = task
  }

  everySecond() {
    this.cronPattern = '* * * * * *'
    return this
  }

  everyMinute() {
    this.cronPattern = '0 * * * * *'
    return this
  }

  everyTwoMinutes() {
    this.cronPattern = '*/2 * * * * *'
    return this
  }

  everyFiveMinutes() {
    this.cronPattern = '*/5 * * * *'
    return this
  }

  everyTenMinutes() {
    this.cronPattern = '*/10 * * * *'
    return this
  }

  everyThirtyMinutes() {
    this.cronPattern = '*/30 * * * *'
    return this
  }

  hourly() {
    this.cronPattern = '0 0 * * * *'
    return this
  }

  daily() {
    this.cronPattern = '0 0 0 * * *'
    return this
  }

  weekly() {
    this.cronPattern = '0 0 0 * * 0'
    return this
  }

  monthly() {
    this.cronPattern = '0 0 0 1 * *'
    return this
  }

  yearly() {
    this.cronPattern = '0 0 0 1 1 *'
    return this
  }

  onDays(days: number[]) {
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

  at(time: string) {
    // Assuming time is in "HH:MM" format
    const [hour, minute] = time.split(':').map(Number)
    this.cronPattern = `${minute} ${hour} * * *`
    return this
  }

  setTimeZone(timezone: string) {
    this.timezone = timezone
    return this
  }

  start() {
    new CronJob(this.cronPattern, this.task, null, true, this.timezone)
    log.info(`Scheduled task with pattern: ${this.cronPattern} in timezone: ${this.timezone}`)
  }

  static command(cmd: string) {
    // log.info(`Executing command: ${cmd}`)
    this.cmd = cmd
    return this
  }
}

export function sendAt(cronTime: string | Date | DateTime): DateTime {
  return new CronTime(cronTime).sendAt()
}

export function timeout(cronTime: string | Date | DateTime): number {
  return new CronTime(cronTime).getTimeout()
}

export type Scheduler = (typeof Schedule)[]

export default Schedule
