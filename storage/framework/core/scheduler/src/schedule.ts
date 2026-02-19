import type { CatchCallbackFn } from '@stacksjs/cron'
import type { ScheduledJob, TimedSchedule, Timezone, UntimedSchedule } from './types'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { runAction } from '@stacksjs/actions'
import { log, runCommand } from '@stacksjs/cli'
import { parse } from '@stacksjs/cron'
import { runJob } from '@stacksjs/queue'

/**
 * Schedule class for creating and managing scheduled tasks.
 *
 * Uses standard 5-field cron patterns (minute hour day month weekday)
 * powered by `@stacksjs/cron` — auto-upgrades to native `Bun.cron.parse()`
 * when available.
 *
 * @example
 * ```ts
 * import { schedule } from '@stacksjs/scheduler'
 *
 * schedule.job('Inspire').hourly().setTimeZone('America/Los_Angeles')
 * schedule.action('CleanupTempFiles').everyFiveMinutes()
 * schedule.command('echo "maintenance"').daily()
 * ```
 */
export class Schedule implements UntimedSchedule {
  private static jobs = new Map<string, ScheduledJob>()
  private cronPattern = ''
  private intervalMs: number | null = null
  private timezone: Timezone = 'America/Los_Angeles'
  private readonly task: () => void
  private static lockDir = join(process.cwd(), 'storage', 'framework', 'locks')
  private static activeLocks = new Set<string>()
  private shouldPreventOverlap = false
  private overlapExpiresAfterMinutes = 24 * 60
  private shouldRunOnOneServer = false
  private shouldRunInBackground = false
  private options: {
    timezone?: string
    catch?: CatchCallbackFn
    maxRuns?: number
    protect?: boolean | ((job: ScheduledJob) => void)
    name?: string
    context?: any
    interval?: number
    startAt?: string | Date
    stopAt?: string | Date
  } = {}

  constructor(task: () => void) {
    this.task = task
    // Start job automatically after all chain methods are called
    setTimeout(() => {
      try {
        this.start()
      }
      catch (error) {
        log.error(`Failed to start scheduled task: ${error}`)
      }
    }, 0)
  }

  /** Expose the resolved cron pattern (useful for testing/debugging) */
  get pattern(): string {
    return this.cronPattern
  }

  // --- Timing methods (standard 5-field cron patterns) ---

  everySecond(): TimedSchedule {
    this.intervalMs = 1000
    this.cronPattern = '@every_second'
    return this as TimedSchedule
  }

  everyMinute(): TimedSchedule {
    this.cronPattern = '* * * * *'
    return this as TimedSchedule
  }

  everyTwoMinutes(): TimedSchedule {
    this.cronPattern = '*/2 * * * *'
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
    this.cronPattern = '0 * * * *'
    return this as TimedSchedule
  }

  everyDay(): TimedSchedule {
    this.cronPattern = '0 0 * * *'
    return this as TimedSchedule
  }

  hourly(): TimedSchedule {
    this.cronPattern = '0 * * * *'
    return this as TimedSchedule
  }

  daily(): TimedSchedule {
    this.cronPattern = '0 0 * * *'
    return this as TimedSchedule
  }

  weekly(): TimedSchedule {
    this.cronPattern = '0 0 * * 0'
    return this as TimedSchedule
  }

  monthly(): TimedSchedule {
    this.cronPattern = '0 0 1 * *'
    return this as TimedSchedule
  }

  yearly(): TimedSchedule {
    this.cronPattern = '0 0 1 1 *'
    return this as TimedSchedule
  }

  annually(): TimedSchedule {
    this.cronPattern = '0 0 1 1 *'
    return this as TimedSchedule
  }

  onDays(days: number[]): TimedSchedule {
    this.cronPattern = `0 0 * * ${days.join(',')}`
    return this as TimedSchedule
  }

  at(time: string): TimedSchedule {
    const [hour, minute] = time.split(':').map(Number)
    this.cronPattern = `${minute} ${hour} * * *`
    return this as TimedSchedule
  }

  // --- Configuration methods ---

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

  withProtection(callback?: (job: ScheduledJob) => void): this {
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

  withoutOverlapping(expiresAfterMinutes?: number): this {
    this.shouldPreventOverlap = true
    if (expiresAfterMinutes !== undefined)
      this.overlapExpiresAfterMinutes = expiresAfterMinutes
    return this
  }

  onOneServer(): this {
    this.shouldRunOnOneServer = true
    return this
  }

  runInBackground(): this {
    this.shouldRunInBackground = true
    return this
  }

  // --- Lock management ---

  private acquireLock(name: string): boolean {
    const lockFile = join(Schedule.lockDir, `${name}.lock`)

    if (!existsSync(Schedule.lockDir)) {
      mkdirSync(Schedule.lockDir, { recursive: true })
    }

    if (Schedule.activeLocks.has(name)) {
      if (existsSync(lockFile)) {
        try {
          const stats = statSync(lockFile)
          const ageMs = Date.now() - stats.mtimeMs
          const expiryMs = this.overlapExpiresAfterMinutes * 60 * 1000
          if (ageMs < expiryMs) {
            return false
          }
        }
        catch {
          // If we can't stat the file, proceed with acquiring
        }
      }
    }

    try {
      writeFileSync(lockFile, String(Date.now()), { flag: 'wx' })
    }
    catch {
      try {
        const stats = statSync(lockFile)
        const ageMs = Date.now() - stats.mtimeMs
        const expiryMs = this.overlapExpiresAfterMinutes * 60 * 1000
        if (ageMs < expiryMs) {
          return false
        }
        writeFileSync(lockFile, String(Date.now()))
      }
      catch {
        return false
      }
    }

    Schedule.activeLocks.add(name)
    return true
  }

  private releaseLock(name: string): void {
    const lockFile = join(Schedule.lockDir, `${name}.lock`)
    Schedule.activeLocks.delete(name)
    try {
      unlinkSync(lockFile)
    }
    catch {
      // Lock file already removed
    }
  }

  // --- Task wrapping ---

  private wrapTask(originalTask: () => void): () => void {
    const taskName = this.options.name || 'unnamed-task'
    let wrappedTask = originalTask

    if (this.shouldPreventOverlap || this.shouldRunOnOneServer) {
      const self = this
      const innerTask = wrappedTask
      wrappedTask = () => {
        if (!self.acquireLock(taskName)) {
          log.info(`Skipping overlapping task: ${taskName}`)
          return
        }
        try {
          const result: any = innerTask()
          if (result && typeof result === 'object' && typeof (result as any).finally === 'function') {
            (result as Promise<any>).finally(() => self.releaseLock(taskName))
          }
          else {
            self.releaseLock(taskName)
          }
        }
        catch (error) {
          self.releaseLock(taskName)
          throw error
        }
      }
    }

    if (this.shouldRunInBackground) {
      const innerTask = wrappedTask
      wrappedTask = () => {
        const child = spawn(process.execPath, ['-e', `(${innerTask.toString()})()`], {
          detached: true,
          stdio: 'ignore',
        })
        child.unref()
        log.info(`Task ${taskName} spawned in background (pid: ${child.pid})`)
      }
    }

    return wrappedTask
  }

  // --- Scheduling engine (powered by @stacksjs/cron parse) ---

  private getNextRunTime(): Date | null {
    if (!this.cronPattern || this.intervalMs !== null) return null

    if (!this.timezone || this.timezone === 'UTC') {
      return parse(this.cronPattern)
    }

    // Timezone-aware scheduling:
    // 1. Get "now" in the configured timezone
    // 2. Parse for next match from that local time
    // 3. Compute delay and add to real now
    const now = new Date()
    const localNow = new Date(now.toLocaleString('en-US', { timeZone: this.timezone }))
    const nextLocal = parse(this.cronPattern, localNow)
    if (!nextLocal) return null

    const delayMs = nextLocal.getTime() - localNow.getTime()
    return new Date(now.getTime() + delayMs)
  }

  private start(): ScheduledJob {
    const task = this.wrapTask(this.task)
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval> | null = null
    let runCount = 0

    const stop = () => {
      stopped = true
      if (timer !== null) {
        if (this.intervalMs !== null)
          clearInterval(timer)
        else
          clearTimeout(timer)
        timer = null
      }
    }

    const nextRun = (): Date | null => {
      return this.getNextRunTime()
    }

    const job: ScheduledJob = { stop, nextRun }

    const executeTask = () => {
      if (this.options.maxRuns && runCount >= this.options.maxRuns) {
        stop()
        return
      }
      runCount++
      try {
        task()
      }
      catch (error) {
        if (this.options.catch) {
          this.options.catch(error as Error)
        }
      }
    }

    if (this.intervalMs !== null) {
      // Sub-minute scheduling (everySecond): use setInterval
      timer = setInterval(() => {
        if (stopped) return
        executeTask()
      }, this.intervalMs)
    }
    else if (this.cronPattern) {
      // Minute+ scheduling: parse() + setTimeout loop
      const scheduleNext = () => {
        if (stopped) return
        if (this.options.maxRuns && runCount >= this.options.maxRuns) return

        const nextTime = this.getNextRunTime()
        if (!nextTime) return

        const delay = Math.max(nextTime.getTime() - Date.now(), 0)
        timer = setTimeout(() => {
          if (stopped) return
          executeTask()
          scheduleNext()
        }, delay)
      }
      scheduleNext()
    }

    if (this.options.name) {
      Schedule.jobs.set(this.options.name, job)
    }

    log.info(`Scheduled task with pattern: ${this.cronPattern} in timezone: ${this.timezone}`)
    return job
  }

  // --- Static factory methods ---

  static job(name: string): UntimedSchedule {
    return new Schedule(async () => {
      log.info(`Running job: ${name}`)
      try {
        await runJob(name)
      }
      catch (error) {
        log.error(`Job ${name} failed:`, error)
        throw error
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

        if (result.isErr) {
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
   */
  static async gracefulShutdown(): Promise<void> {
    log.info('Gracefully shutting down scheduled jobs...')

    for (const [name, job] of Schedule.jobs) {
      log.info(`Stopping job: ${name}`)
      job.stop()
    }

    Schedule.jobs.clear()
    log.info('All jobs have been stopped')
  }
}

export class Queue extends Schedule { }

/**
 * Get the next run time for a cron expression.
 *
 * @param cronExpression - Standard 5-field cron expression or nickname
 * @returns The next Date the expression matches, or null
 */
export function sendAt(cronExpression: string | Date): Date | null {
  if (cronExpression instanceof Date) {
    return cronExpression > new Date() ? cronExpression : null
  }
  return parse(cronExpression)
}

/**
 * Get the number of milliseconds until the next run of a cron expression.
 *
 * @param cronExpression - Standard 5-field cron expression or nickname
 * @returns Milliseconds until next run, or -1 if no upcoming run
 */
export function timeout(cronExpression: string | Date): number {
  const next = sendAt(cronExpression)
  if (!next) return -1
  return next.getTime() - Date.now()
}

export type Scheduler = typeof Schedule
export const schedule: Scheduler = Schedule

export default Schedule
