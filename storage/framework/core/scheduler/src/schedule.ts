import type { CatchCallbackFn } from '@stacksjs/cron'
import type { ScheduledJob, TimedSchedule, Timezone, UntimedSchedule } from './types'
import type { NotificationChannel, NotificationPayload, NotificationRecipient, NotifyOptions } from '@stacksjs/notifications'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { closeSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { runNamedAction } from '@stacksjs/action-runner'
import { log, runCommand } from '@stacksjs/cli'
import { parse } from '@stacksjs/cron'
import { job as queuedJob, runJob } from '@stacksjs/queue'
import type { SchedulerLockHandle } from './scheduler-lock'
import { acquireSchedulerLock } from './scheduler-lock'

/**
 * A stable name for a scheduled notification: the same notification gets the
 * same name in every process, which is what `schedule:run-one` and the
 * pause list look it up by, and two different ones never share it.
 */
function notificationTaskName(...parts: unknown[]): string {
  const canonical = JSON.stringify(parts, (_key, value: unknown) => {
    if (typeof value === 'bigint') return `${value}n`
    if (typeof value === 'function') return `[function ${value.name}]`
    // Key order is not part of the notification.
    if (value && typeof value === 'object' && !Array.isArray(value))
      return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
    return value
  })
  return `notification-${createHash('sha256').update(canonical).digest('hex').slice(0, 12)}`
}

function toWindowDate(value: string | Date, label: string): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  if (Number.isNaN(date.getTime()))
    throw new Error(`between(): ${label} is not a valid date: ${String(value)}`)
  return date
}

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
/**
 * The jobs an application has, for `schedule.job(…)` to be checked against.
 *
 * Empty here and augmented by the application's own declarations, which derive
 * it from the jobs registry - see the `declare module '@stacksjs/scheduler'`
 * block in `storage/framework/types/registries.d.ts`. The scheduler cannot name
 * them itself: importing the barrel from this package would drag every job
 * module into every compilation that touches the scheduler.
 *
 * This used to point at `storage/framework/types/scheduled.d.ts`, the 1500-line
 * generated union the registry replaced. That file is gone, and
 * `name-registries.test.ts` asserts it stays gone, so the pointer sent anyone
 * checking whether the guard was live to a file whose absence looked like the
 * guard being dead.
 *
 * Empty means any string, so an application that declares nothing is unchanged.
 */
// eslint-disable-next-line ts/no-empty-object-type -- augmentation target; empty by design
export interface SchedulableJobs {}

/** The same, for `schedule.action(…)`. @see {@link SchedulableJobs} */
// eslint-disable-next-line ts/no-empty-object-type -- augmentation target; empty by design
export interface SchedulableActions {}

/**
 * A job name `schedule.job()` accepts.
 *
 * `schedule.job('Inpsire')` used to type-check and fail at the scheduled hour,
 * with the misspelling visible only in a log line nobody was reading at 3am.
 */
export type SchedulableJobName = keyof SchedulableJobs extends never
  ? string
  : Extract<keyof SchedulableJobs, string>

/** An action path `schedule.action()` accepts. @see {@link SchedulableJobName} */
export type SchedulableActionName = keyof SchedulableActions extends never
  ? string
  : Extract<keyof SchedulableActions, string>

export class Schedule implements UntimedSchedule {
  private static jobs = new Map<string, ScheduledJob>()
  // Dedupe registry: normalized job name + cron pattern → the timer already
  // started for it, so scheduling the same job on the same cadence twice (a
  // Job's `rate` auto-scheduled by the runner + an explicit Scheduler.ts entry)
  // creates ONE timer, not two. See start().
  private static scheduledKeys = new Map<string, ScheduledJob>()
  private cronPattern = ''
  private intervalMs: number | null = null
  private timezone: Timezone = 'America/Los_Angeles'
  private readonly task: (context?: any) => unknown
  private static lockDir = join(process.cwd(), 'storage', 'framework', 'locks')
  private static stateFile = join(process.cwd(), 'storage', 'framework', 'runtime', 'scheduler-state.json')
  private static activeLocks = new Map<string, SchedulerLockHandle>()
  /** Each background task's run in this process, for `runNow(name, { inProcess: true })`. */
  private static inProcessRuns = new Map<string, () => Promise<void>>()
  private shouldPreventOverlap = false
  private overlapExpiresAfterMinutes = 24 * 60
  private shouldRunOnOneServer = false
  private shouldRunInBackground = false
  /** stdout/stderr redirect target (S-3). Null = no capture. */
  private outputPath: string | null = null
  /** When true, append to outputPath; otherwise overwrite per run. */
  private outputAppend = false
  /** A command task redirects its own output to `outputPath`. */
  private handlesOwnOutput = false
  /** Set by `schedule.job(name)`: the job this schedule runs. */
  private jobName: string | null = null
  /** Set by `.onQueue(name)`: dispatch the job there instead of running it here. */
  private dispatchQueue: string | null = null
  private options: {
    timezone?: string
    catch?: CatchCallbackFn
    maxRuns?: number
    protect?: boolean | ((_job: ScheduledJob) => void)
    name?: string
    context?: any
    interval?: number
    startAt?: Date
    stopAt?: Date
  } = {}

  constructor(task: (context?: any) => unknown) {
    this.task = task
    // Defer `start()` until the synchronous chain settles. Users write
    // `schedule(task).daily().withName('x')` — `start()` can't run
    // inside the constructor because `cronPattern` hasn't been set
    // yet, but it should run *as soon as* the chain finishes (no
    // observable delay).
    //
    // queueMicrotask is the right primitive here: it runs after the
    // current synchronous run-to-completion (so all chain methods
    // have set their fields) but before any I/O turn — measurably
    // tighter than setTimeout(0), which gets queued behind every
    // pending timer in the loop.
    queueMicrotask(() => {
      try {
        this.start()
      }
      catch (error) {
        log.error(`Failed to start scheduled task: ${error}`)
      }
    })
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

  /** Every day at "HH:MM" - `.daily().at(time)`. */
  dailyAt(time: string): TimedSchedule {
    this.cronPattern = '0 0 * * *'
    return this.at(time)
  }

  /**
   * Monday to Friday only. Keeps a time of day already set, and is midnight
   * otherwise, so `.weekdays().at('09:00')` and `.at('09:00').weekdays()`
   * agree.
   */
  weekdays(): TimedSchedule {
    const fields = this.cronPattern.trim().split(/\s+/)
    const [minute, hour] = fields.length === 5 ? fields : ['0', '0']
    this.cronPattern = `${minute} ${hour} * * 1-5`
    return this as TimedSchedule
  }

  onDays(days: number[]): TimedSchedule {
    // Each day-of-week field in cron is 0-6 (Sun-Sat). A typo'd
    // `[32]` used to silently produce a pattern that never fires;
    // surface it at definition time instead.
    if (!Array.isArray(days) || days.length === 0) {
      throw new Error(`onDays() requires a non-empty array; got ${JSON.stringify(days)}`)
    }
    for (const d of days) {
      if (!Number.isInteger(d) || d < 0 || d > 6) {
        throw new Error(`onDays(): each day must be an integer 0-6 (Sun-Sat). Got ${d}`)
      }
    }
    this.cronPattern = `0 0 * * ${days.join(',')}`
    return this as TimedSchedule
  }

  at(time: string): TimedSchedule {
    const parts = time.split(':')
    if (parts.length !== 2 || parts[0] === '' || parts[1] === '') {
      throw new Error(`Invalid time format "${time}". Expected "HH:MM" (e.g., "14:30")`)
    }
    const [hour, minute] = parts.map(Number) as [number | undefined, number | undefined]
    if (hour === undefined || minute === undefined || Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw new Error(`Invalid time "${time}". Hour must be 0-23, minute must be 0-59`)
    }
    // Only the time of day changes. `.weekly().at('09:00')` and
    // `.monthly().at('09:00')` are the documented spellings, and rebuilding
    // the whole pattern as `m h * * *` quietly turned both into daily jobs:
    // a Monday digest sent every morning. The day, month and weekday fields a
    // timing method set are kept; with none set yet, this is a daily time.
    const fields = this.cronPattern.trim().split(/\s+/)
    const [dayOfMonth, month, dayOfWeek] = fields.length === 5 ? fields.slice(2) : ['*', '*', '*']
    this.cronPattern = `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`
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

  /**
   * Skip a tick while the previous run of this task is still going, in this
   * process. `callback`, when given, hears about each skipped tick.
   * `withoutOverlapping()` is the cross-process form, through a lock.
   */
  withProtection(callback?: (job: ScheduledJob) => void): this {
    this.options.protect = callback || true
    return this
  }

  withName(name: string): this {
    this.options.name = name
    return this
  }

  /**
   * A value handed to the task on every run: as the callback's argument for
   * `new Schedule(fn)`, and as the job's `context` for `schedule.job(...)`.
   */
  withContext(context: any): this {
    this.options.context = context
    return this
  }

  /**
   * At least this many seconds between two runs. A tick that comes sooner
   * after the last run started is skipped.
   */
  withInterval(seconds: number): this {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0)
      throw new Error(`withInterval() takes a positive number of seconds; got ${String(seconds)}`)
    this.options.interval = seconds
    return this
  }

  /**
   * Only run from `startAt` until `stopAt`. Ticks before the window are
   * skipped, and the task stops for good once the window has passed.
   *
   * Both ends were stored and never read, so a campaign job scheduled
   * `.between(launch, end)` ran from the moment it was registered and kept
   * running after the end date.
   */
  between(startAt: string | Date, stopAt: string | Date): this {
    const start = toWindowDate(startAt, 'startAt')
    const stop = toWindowDate(stopAt, 'stopAt')
    if (stop.getTime() <= start.getTime())
      throw new Error(`between(): stopAt (${stop.toISOString()}) must be after startAt (${start.toISOString()})`)
    this.options.startAt = start
    this.options.stopAt = stop
    return this
  }

  /**
   * Dispatch the scheduled job onto this queue for a worker to run, rather
   * than running it in the scheduler process. Only `schedule.job(...)` has a
   * job to dispatch.
   */
  onQueue(queue: string): this {
    if (this.jobName === null)
      throw new Error('onQueue() applies to schedule.job(...) only: an action, command or callback has no job to dispatch')
    if (typeof queue !== 'string' || queue.trim() === '')
      throw new Error(`onQueue() takes a queue name; got ${JSON.stringify(queue)}`)
    this.dispatchQueue = queue
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

  /**
   * Redirect this task's stdout/stderr to `path` (overwrite mode).
   * Implemented for `schedule.command(...)` shell tasks
   * (stacksjs/stacks#1877 S-3) — captures the spawned process's
   * stdio to the file. For `schedule.job(...)` / `schedule.action(...)`
   * tasks, the framework's logger already routes to whatever
   * sink is configured globally, so this option is a no-op for
   * those (with a one-time warn).
   *
   * @example
   * ```ts
   * schedule.command('backup.sh').daily().sendOutputTo('/var/log/stacks/backup.log')
   * ```
   */
  sendOutputTo(path: string): this {
    this.outputPath = path
    this.outputAppend = false
    return this
  }

  /**
   * Same as `sendOutputTo` but appends instead of overwriting. Use
   * when you want a rolling log of every scheduled run.
   */
  appendOutputTo(path: string): this {
    this.outputPath = path
    this.outputAppend = true
    return this
  }

  /**
   * Fire the task once for every cron slot that was missed since
   * `since` (stacksjs/stacks#1877 Cr-4). The default scheduler
   * search-forward semantics discard missed runs silently — a
   * server that was down for 5 minutes loses 5 ticks of a
   * `* * * * *` task. This helper walks the cron expression
   * forward from `since` and invokes the task for each matching
   * slot up to `Date.now()`.
   *
   * Persistence is the caller's responsibility: store the task's
   * lastRunAt timestamp somewhere (DB, file, etc.) on every run,
   * then pass that timestamp as `since` on the next boot.
   *
   * `max` (default 100) caps the catch-up so a long outage doesn't
   * bury the system in stale work. Beyond `max`, the helper logs
   * a warn and skips ahead to the most recent slot.
   *
   * @example
   * ```ts
   * // Inside the task: write lastRunAt after each successful run.
   * await schedule.job('ProcessQueue')
   *   .everyMinute()
   *   .runMissed({ since: lastSavedRunAt, max: 60 })
   * ```
   */
  async runMissed(opts: { since: Date | number, max?: number }): Promise<number> {
    if (!this.cronPattern) {
      log.warn('[scheduler] runMissed() requires a cron-based schedule; interval-based tasks (everySecond) have no concept of missed slots')
      return 0
    }
    const max = opts.max ?? 100
    const since = opts.since instanceof Date ? opts.since.getTime() : opts.since
    const now = Date.now()
    if (since >= now) return 0

    // The newest `max` slots since `since`. The loop used to stop after max+1
    // and drop one, so it kept the OLDEST slots - after ten minutes down with
    // `max: 3` it fired 09:51-09:53 and called it "4 missed" - while the docs
    // promise it "skips ahead to the most recent". Walking every slot from
    // `since` instead costs ~50µs a slot, seconds for a long outage, so the
    // window grows back from `now` until it holds more than `max` or reaches
    // `since`. The right boundary is inclusive: a slot whose minute is "now"
    // counts as missed, the common case after a boot that lands just past a
    // slot. In the task's own zone, as its live schedule is.
    const tz = this.timezone && this.timezone !== 'UTC' ? { tz: this.timezone } : {}
    const slotsAfter = (from: number): Date[] => {
      const found: Date[] = []
      let cursor = from
      while (true) {
        const next = parse(this.cronPattern, cursor, tz)
        if (!next || next.getTime() > now) return found
        found.push(next)
        cursor = next.getTime()
      }
    }

    let span = 60_000 * (max + 1)
    let from = Math.max(since, now - span)
    let slots = slotsAfter(from)
    while (slots.length <= max && from > since) {
      span *= 2
      from = Math.max(since, now - span)
      slots = slotsAfter(from)
    }

    if (slots.length > max) {
      const missed = from === since ? `${slots.length}` : `more than ${max}`
      log.warn(`[scheduler] runMissed: ${missed} missed slots since ${new Date(since).toISOString()}, running the ${max} most recent - older runs dropped`)
      slots = slots.slice(-max)
    }

    let fired = 0
    for (const slot of slots) {
      try {
        const result = this.task(this.options.context)
        if (result && typeof (result as Promise<unknown>).then === 'function')
          await (result as Promise<unknown>)
        fired++
      }
      catch (err) {
        log.error(`[scheduler] runMissed slot ${slot.toISOString()} failed: ${err instanceof Error ? err.message : String(err)}`)
        if (this.options.catch) this.options.catch(err as Error)
      }
    }
    return fired
  }

  /**
   * Snapshot every currently-registered scheduled job
   * (stacksjs/stacks#1877 S-1). Returned objects share the
   * `ScheduledJob` shape with `pattern` / `timezone` / `name` /
   * `nextRun` populated. Used by `buddy schedule:list` to give
   * operators a view of what's scheduled and when it next runs,
   * without having to read source.
   */
  static listJobs(): Array<{ name: string, pattern?: string, timezone?: Timezone, nextRun: Date | null, enabled: boolean }> {
    const out: Array<{ name: string, pattern?: string, timezone?: Timezone, nextRun: Date | null, enabled: boolean }> = []
    for (const [name, job] of Schedule.jobs) {
      out.push({
        name,
        pattern: job.pattern,
        timezone: job.timezone,
        nextRun: job.nextRun ? job.nextRun() : null,
        enabled: Schedule.isEnabled(name),
      })
    }
    return out
  }

  /**
   * Run one registered task through its normal overlap and error guards.
   *
   * `inProcess` runs a `runInBackground()` task here rather than spawning it
   * again - it is how the background process itself runs the task.
   */
  static async runNow(name: string, options: { inProcess?: boolean } = {}): Promise<void> {
    const job = Schedule.jobs.get(name)
    if (!job)
      throw new Error(`Scheduled task "${name}" was not found.`)
    if (!Schedule.isEnabled(name))
      throw new Error(`Scheduled task "${name}" is paused.`)
    const here = options.inProcess ? Schedule.inProcessRuns.get(name) : undefined
    await (here ? here() : job.run())
  }

  /** Persist an operator pause independently from the scheduler process. */
  static setEnabled(name: string, enabled: boolean): void {
    const disabled = Schedule.disabledJobs()
    if (enabled)
      disabled.delete(name)
    else
      disabled.add(name)

    const directory = join(process.cwd(), 'storage', 'framework', 'runtime')
    mkdirSync(directory, { recursive: true })
    const temporary = `${Schedule.stateFile}.${process.pid}.tmp`
    writeFileSync(temporary, `${JSON.stringify({ disabled: [...disabled].sort() }, null, 2)}\n`, { mode: 0o600 })
    renameSync(temporary, Schedule.stateFile)
  }

  static isEnabled(name: string): boolean {
    return !Schedule.disabledJobs().has(name)
  }

  /**
   * Whether a job of this name already has a scheduled task.
   *
   * The scheduler has two sources: a `rate` on the job file, and an explicit
   * entry in `app/Scheduler.ts`. A job that appears in both was registered
   * twice and ran twice - see `runScheduler`, which uses this to let the
   * explicit entry win, since only it can carry a timezone and an overlap
   * policy.
   */
  static isScheduled(name: string): boolean {
    return Schedule.jobs.has(name)
  }

  private static disabledJobs(): Set<string> {
    try {
      const value = JSON.parse(readFileSync(Schedule.stateFile, 'utf8')) as { disabled?: unknown }
      return new Set(Array.isArray(value.disabled) ? value.disabled.filter((name): name is string => typeof name === 'string') : [])
    }
    catch {
      return new Set()
    }
  }

  /**
   * Snapshot currently-held overlap / one-server locks (the JS-side
   * activeLocks map). Used by `buddy schedule:status` to surface
   * which tasks are mid-flight when a tick fires
   * (stacksjs/stacks#1877 S-1). Does NOT cross instance boundaries —
   * for cluster-wide lock state, query the database directly.
   */
  static listLocks(): string[] {
    return Array.from(Schedule.activeLocks.keys())
  }

  // --- Lock management ---
  //
  // Pre-fix (#1877 Cr-3): file-only lock in `storage/framework/locks/<name>.lock`.
  // Worked for a single process but completely failed to serialize across
  // instances — `onOneServer()` and `withoutOverlapping()` both silently
  // no-op'd in multi-instance deployments because each box had its own
  // lock directory.
  //
  // Post-fix: pair the file lock with a DB-backed advisory lock when a
  // SQL connection is available. PG advisory locks are session-scoped
  // (auto-release on disconnect), MySQL named locks the same. SQLite
  // falls back to file-only since SQLite is single-writer anyway.

  private async acquireLock(name: string): Promise<boolean> {
    // Already locked by this process? — fast path, no DB round-trip.
    if (Schedule.activeLocks.has(name)) return false

    const expiryMs = this.overlapExpiresAfterMinutes * 60 * 1000

    // Resolve the SQL dialect + connection lazily so the scheduler
    // doesn't import @stacksjs/database at module-load time (tests
    // and CLI scripts that don't touch the DB shouldn't pay for it).
    // `onOneServer()` REQUIRES the DB; `withoutOverlapping()` works
    // with either path.
    let dialect: 'sqlite' | 'mysql' | 'postgres' | null = null
    let adminDb: { unsafe: (sql: string) => Promise<unknown> } | null = null

    if (this.shouldRunOnOneServer) {
      try {
        const { db } = await import('@stacksjs/database/runtime')
        // The Stacks db proxy exposes a Bun.SQL-compatible `unsafe`
        // method — same shape `migration-lock.ts` uses.
        adminDb = db as unknown as { unsafe: (sql: string) => Promise<unknown> }
        // Inspect env to determine dialect (no driver-detect API on
        // the db proxy itself).
        const driver = (await import('@stacksjs/env')).env.DB_CONNECTION || 'sqlite'
        if (driver === 'postgres' || driver === 'mysql' || driver === 'sqlite') {
          dialect = driver
        }
      }
      catch (err) {
        // No DB connection available — onOneServer() degrades to
        // file-lock-only with a warning. Better than silently
        // running on every instance.
        log.warn(`[scheduler] onOneServer() couldn't reach DB; falling back to file-only lock (which only serializes within this process): ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    const handle = await acquireSchedulerLock(name, expiryMs, dialect, adminDb, Schedule.lockDir)
    if (!handle) return false

    Schedule.activeLocks.set(name, handle)
    return true
  }

  private async releaseLock(name: string): Promise<void> {
    const handle = Schedule.activeLocks.get(name)
    if (!handle) return
    Schedule.activeLocks.delete(name)
    await handle.release()
  }

  // --- Task wrapping ---

  private wrapTask(originalTask: () => unknown, inProcess = false): () => unknown {
    const taskName = this.options.name || 'unnamed-task'
    let wrappedTask: () => unknown = originalTask

    if (this.shouldPreventOverlap || this.shouldRunOnOneServer) {
      const self = this
      const innerTask = wrappedTask
      // Lock acquisition is async (a DB advisory lock can require a round-trip)
      // while cron ticks are sync, so the guarded body has to be a Promise.
      //
      // It is RETURNED rather than discarded, which is the whole of
      // stacksjs/stacks#2403. This used to be `void (async () => {…})()`, so
      // every caller expecting to await the task got `undefined`: the runner's
      // `if (result?.then) await result` never fired, `withErrorHandler` never
      // saw a guarded task fail, and `Schedule.runNow()` resolved in ~0ms while
      // the task was still running and about to throw. Three behaviours, one
      // missing `return`, and only for tasks that chain `.withoutOverlapping()`
      // or `.onOneServer()` - which is the combination the framework's own docs
      // put in their worked example.
      wrappedTask = () => (async () => {
        // Deliberately NOT in a try: a lock layer that cannot answer is a
        // failure to run, and the runner is what decides what that means.
        // Previously it sat in a detached promise, so an unwritable lock
        // directory (`ENOTDIR`, a full disk, a read-only mount) surfaced as an
        // unhandled rejection, which terminates the process under Bun's
        // default policy.
        const acquired = await self.acquireLock(taskName)
        if (!acquired) {
          log.info(`Skipping overlapping task: ${taskName}`)
          return
        }
        try {
          const result: unknown = innerTask()
          if (result && typeof result === 'object' && typeof (result as { finally?: unknown }).finally === 'function') {
            await (result as Promise<unknown>)
          }
        }
        finally {
          // Swallowed on purpose, and only here. A throw from `finally`
          // REPLACES the task's own error, so an unguarded release would hide
          // the failure the operator actually needs to see behind a lock-file
          // complaint - and it is already too late to do anything about the
          // release.
          try {
            await self.releaseLock(taskName)
          }
          catch (error) {
            log.error(`[scheduler] releasing the lock for ${taskName} failed: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
      })()
    }

    if (this.shouldRunInBackground && !inProcess) {
      // A background run is this task, by name, in a process of its own:
      // `buddy schedule:run-one <name> --in-process` registers the app's
      // schedule the way `schedule:run` does and runs the one task there,
      // overlap lock and all.
      //
      // It used to evaluate the task's SOURCE in `bun -e`, which only works for
      // a function that refers to nothing outside itself. Every task the
      // framework builds does: `schedule.job(name)` closes over `name` and
      // `runJob`, `schedule.action` over `runNamedAction`, `schedule.command`
      // over `cmd`. So every one of them died in the child on a ReferenceError,
      // and only the exit code reached the log.
      //
      // The lock is the child's to take. Taking it here as well would hold it
      // for the instant the spawn takes, then let a second child start while
      // the first was still working.
      const buddy = join(process.cwd(), 'buddy')
      // A command task writes its output to the file itself; anything else
      // has its process's output captured there.
      const outputPath = this.handlesOwnOutput ? null : this.outputPath
      const outputAppend = this.outputAppend
      wrappedTask = () => {
        let output: number | 'inherit' = 'inherit'
        if (outputPath) {
          try {
            output = openSync(outputPath, outputAppend ? 'a' : 'w')
          }
          catch (err) {
            log.warn(`[scheduler] couldn't open ${outputPath} for background task ${taskName}: ${err instanceof Error ? err.message : String(err)}; its output goes to this process instead`)
          }
        }
        const closeOutput = () => {
          if (typeof output !== 'number') return
          try {
            closeSync(output)
          }
          catch {
            // Already closed: nothing to recover.
          }
          output = 'inherit'
        }

        const child = spawn(buddy, ['schedule:run-one', taskName, '--in-process'], {
          cwd: process.cwd(),
          detached: true,
          stdio: ['ignore', output, output],
        })
        // The child holds its own copy of the descriptor.
        closeOutput()
        child.on('error', (error) => {
          log.error(`[scheduler] background task ${taskName} failed to start (${buddy}): ${error.message}`)
        })
        // Crash visibility (stacksjs/stacks#1877 S-2): `.unref()` hands the
        // child to the OS, so its exit is the only signal there is.
        child.on('exit', (code, signal) => {
          if (code !== 0 && code !== null)
            log.error(`[scheduler] background task ${taskName} (pid: ${child.pid}) exited with code ${code}`)
          else if (signal)
            log.warn(`[scheduler] background task ${taskName} (pid: ${child.pid}) terminated by signal ${signal}`)
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

    // Not before the `between()` window opens, and nothing once it has closed.
    const { startAt, stopAt } = this.options
    // The base is always explicit: Bun's native parser reads its own clock when
    // given none, which is not the `Date.now()` the delay is measured against.
    const now = Date.now()
    const base = startAt && startAt.getTime() > now ? startAt.getTime() - 1 : now
    const next = this.nextCronTime(base)
    if (next && stopAt && next.getTime() > stopAt.getTime()) return null
    return next
  }

  private nextCronTime(base: number): Date | null {
    if (!this.timezone || this.timezone === 'UTC') {
      return parse(this.cronPattern, base)
    }

    // Timezone-aware scheduling via parseCron's `tz` option
    // (stacksjs/stacks#1877 Cr-1 — closes the DST drift gap).
    //
    // Pre-fix: this method computed `localNow = new Date(now.toLocaleString(tz))`,
    // parsed the cron against that local time in UTC mode, then added
    // the resulting delta back to `now.getTime()`. That worked when the
    // TZ offset was stable but went off by ±1h across DST transitions —
    // the offset on the "local now" side and the "local match" side
    // differed by an hour during spring-forward / fall-back windows,
    // so the wall-clock delta no longer mapped cleanly to UTC.
    //
    // Post-fix: parseCron's tz-aware part-extractor uses
    // `Intl.DateTimeFormat.formatToParts` which auto-handles DST.
    // The search loop walks UTC milliseconds; field comparisons run
    // against the local-in-tz view of each candidate instant. Spring-
    // forward: the cron's target local time is skipped that day
    // (the task doesn't fire because the wall-clock instant doesn't
    // exist). Fall-back: the target local time happens twice, and
    // the scheduler fires twice on the transition day — apps that
    // care need idempotency keys or exclusive locks on the task body.
    return parse(this.cronPattern, base, { tz: this.timezone })
  }

  private start(): ScheduledJob {
    if (!this.cronPattern && this.intervalMs === null) {
      return { stop: () => {}, run: async () => {}, nextRun: () => null }
    }

    // Dedupe: the same job scheduled on the same cadence twice — e.g. a Job's
    // `rate` auto-scheduled by the runner AND an explicit `schedule.job(...)` in
    // the app's Scheduler.ts — must create ONE timer, not two (else it fires
    // twice). Key on the normalized name + pattern, so a job intentionally
    // scheduled on two DIFFERENT cadences still gets both timers.
    const dedupeKey = this.options.name
      ? `${this.options.name.toLowerCase().replace(/[^a-z0-9]+/g, '')}::${this.cronPattern || `every:${this.intervalMs}`}`
      : null
    if (dedupeKey) {
      const existing = Schedule.scheduledKeys.get(dedupeKey)
      if (existing) {
        log.debug(`[scheduler] duplicate schedule for "${this.options.name}" (${this.cronPattern || `every ${this.intervalMs}ms`}) skipped`)
        return existing
      }
    }

    // A background task is run by name in a child process, which has nothing
    // else to find it by.
    if (this.shouldRunInBackground && !this.options.name)
      throw new Error('runInBackground() needs a named task: add .withName(...) so the background process can find it')

    const context = this.options.context
    const base = context === undefined ? this.task : () => this.task(context)
    const task = this.wrapTask(base)
    // What the background process runs: the same task, in that process.
    const taskHere = this.shouldRunInBackground ? this.wrapTask(base, true) : task
    let stopped = false
    let running = false
    let lastStartedAt: number | null = null
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

    const taskName = this.options.name || 'unnamed-task'
    const runTask = async (body: () => unknown): Promise<void> => {
      if (!Schedule.isEnabled(taskName)) {
        log.debug(`[scheduler] task ${taskName} is paused`)
        return
      }
      const { startAt, stopAt, interval, protect } = this.options
      const now = Date.now()
      if (stopAt && now > stopAt.getTime()) {
        log.debug(`[scheduler] task ${taskName} is past its between() window; stopping`)
        stop()
        return
      }
      if (startAt && now < startAt.getTime()) {
        log.debug(`[scheduler] task ${taskName} has not reached its between() window`)
        return
      }
      if (this.options.maxRuns && runCount >= this.options.maxRuns) {
        stop()
        return
      }
      if (protect && running) {
        log.debug(`[scheduler] task ${taskName} is still running; skipping this tick (withProtection)`)
        if (typeof protect === 'function') protect(job)
        return
      }
      if (interval && lastStartedAt !== null && now - lastStartedAt < interval * 1000) {
        log.debug(`[scheduler] task ${taskName} ran less than ${interval}s ago; skipping this tick (withInterval)`)
        return
      }
      runCount++
      running = true
      lastStartedAt = now
      try {
        const result = body()
        // Handle promise-returning tasks: a rejection from an async task
        // would otherwise become an unhandled rejection (the synchronous
        // try/catch above can't see it). Now those route through the
        // configured `.catch` handler just like sync errors do.
        //
        // Limitation (stacksjs/stacks#1877 S-4): this only catches the
        // returned Promise's own rejection. A callback that detaches
        // an INNER promise (fire-and-forget fetch, dangling .then
        // chain) can still throw asynchronously after we've moved on
        // — there's no general way to capture those from outside the
        // callback. Apps that rely on the .catch handler firing for
        // every error MUST `await` every inner promise; we can't fix
        // that boundary, only document it.
        if (result && typeof (result as Promise<unknown>).then === 'function')
          await (result as Promise<unknown>)
      }
      catch (error) {
        if (this.options.catch) {
          this.options.catch(error as Error)
        }
        else {
          log.error(`[scheduler] task ${taskName} failed (no withErrorHandler() installed): ${error instanceof Error ? error.message : String(error)}`)
        }
        throw error
      }
      finally {
        running = false
      }
    }
    const executeTask = (): Promise<void> => runTask(task)

    const job: ScheduledJob = {
      stop,
      run: executeTask,
      nextRun,
      pattern: this.intervalMs !== null ? `every ${this.intervalMs / 1000}s` : this.cronPattern,
      timezone: this.timezone,
      name: this.options.name,
      enabled: Schedule.isEnabled(taskName),
    }

    if (this.intervalMs !== null) {
      // Sub-minute scheduling (everySecond): use setInterval.
      // .unref() so the timer doesn't pin the event loop open after
      // every other work item finishes — without this, a CLI script
      // that registers a `.everySecond()` schedule blocks the process
      // from exiting cleanly.
      timer = setInterval(() => {
        if (stopped) return
        void executeTask().catch(() => {})
      }, this.intervalMs)
      ;(timer as ReturnType<typeof setInterval> & { unref?: () => void }).unref?.()
    }
    else if (this.cronPattern) {
      // Minute+ scheduling: parse() + setTimeout loop
      // setTimeout max is 2^31-1 ms (~24.8 days). For longer delays, chain shorter timeouts.
      const MAX_TIMEOUT = 2147483647
      const scheduleNext = () => {
        if (stopped) return
        if (this.options.maxRuns && runCount >= this.options.maxRuns) return

        const nextTime = this.getNextRunTime()
        if (!nextTime) {
          stop()
          return
        }

        const delay = Math.max(nextTime.getTime() - Date.now(), 0)
        if (delay > MAX_TIMEOUT) {
          // Delay exceeds setTimeout max — wait the max then re-check
          timer = setTimeout(() => {
            if (stopped) return
            scheduleNext()
          }, MAX_TIMEOUT)
        }
        else {
          timer = setTimeout(() => {
            if (stopped) return
            void executeTask().catch(() => {})
            scheduleNext()
          }, delay)
        }
      }
      scheduleNext()
    }

    if (this.options.name) {
      Schedule.jobs.set(this.options.name, job)
      Schedule.inProcessRuns.set(this.options.name, () => runTask(taskHere))
    }
    if (dedupeKey) {
      Schedule.scheduledKeys.set(dedupeKey, job)
    }

    log.info(`Scheduled task with pattern: ${this.cronPattern} in timezone: ${this.timezone}`)
    return job
  }

  // --- Static factory methods ---

  static job(name: SchedulableJobName): UntimedSchedule {
    // Read at run time, so an `.onQueue()` chained after this is seen.
    let instance: Schedule | null = null
    instance = new Schedule(async (context?: unknown) => {
      const queue = instance?.dispatchQueue ?? null
      try {
        if (queue !== null) {
          log.info(`Dispatching job: ${name} to queue ${queue}`)
          const pending = queuedJob(name).onQueue(queue)
          await (context === undefined ? pending : pending.withContext(context)).dispatch()
          return
        }
        log.info(`Running job: ${name}`)
        await runJob(name, context === undefined ? {} : { context })
      }
      catch (error) {
        log.error(`Job ${name} failed:`, error)
        throw error
      }
    })
    instance.jobName = name
    return instance.withName(name) as UntimedSchedule
  }

  static action(name: SchedulableActionName): UntimedSchedule {
    return new Schedule(async () => {
      log.info(`Running action: ${name}`)
      try {
        await runNamedAction(name)
      }
      catch (error) {
        log.error(`Action ${name} failed:`, error)
        throw error
      }
    }).withName(name) as UntimedSchedule
  }

  static command(cmd: string): UntimedSchedule {
    // Defer field-reads to task-execution time so `.sendOutputTo(...)`
    // chained AFTER `.command(...)` is observed (stacksjs/stacks#1877
    // S-3). Holder pattern lets us reference the Schedule instance
    // inside the task closure without circular construction.
    let instance: Schedule | null = null
    const task = async () => {
      const outputPath = instance?.outputPath ?? null
      const outputAppend = instance?.outputAppend ?? false
      try {
        log.info(`Executing command: ${cmd}`)
        if (outputPath) {
          // Spawn directly so we can redirect stdio to the file —
          // runCommand wraps a Bun.spawn that doesn't expose the
          // stdio redirect option.
          const { spawn: childSpawn } = await import('node:child_process')
          const { openSync, closeSync } = await import('node:fs')
          const flag = outputAppend ? 'a' : 'w'
          const fd = openSync(outputPath, flag)
          try {
            await new Promise<void>((resolve, reject) => {
              const child = childSpawn(cmd, {
                shell: true,
                stdio: ['ignore', fd, fd],
              })
              child.on('error', reject)
              child.on('exit', (code) => {
                if (code === 0) resolve()
                else reject(new Error(`Command '${cmd}' exited with code ${code}`))
              })
            })
          }
          finally {
            closeSync(fd)
          }
          return
        }

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
    }
    instance = new Schedule(task)
    instance.handlesOwnOutput = true
    return instance.withName(`command-${cmd}`) as UntimedSchedule
  }

  /**
   * Schedule a notification dispatch on a cron tick (stacksjs/stacks#930).
   *
   * Thin wrapper around `notify(...)` from `@stacksjs/notifications` —
   * avoids the boilerplate of writing an Action just to send a daily
   * digest or weekly report.
   *
   * `@stacksjs/notifications` is lazy-imported so the scheduler keeps a
   * narrow dep graph at boot; only schedules that actually use this
   * factory pull in the notifications module.
   *
   * Each notification is named after what it sends, so two of them are two
   * tasks. They were all named `notification`, and the scheduler drops a
   * second task with the same name and cadence as a duplicate: of a team
   * digest and a billing digest both sent `.daily()`, only the first went
   * out. Name one yourself with `.withName(...)` to run or pause it by name.
   *
   * A run fails when any channel fails to deliver. `notify()` reports a
   * failed channel in its result rather than throwing, so a digest nobody
   * received used to count as a successful run.
   *
   * @example
   * ```ts
   * schedule.notification(
   *   { email: 'team@example.com' },
   *   { subject: 'Daily report', body: '...' },
   *   ['email'],
   * ).dailyAt('08:00')
   * ```
   */
  static notification(
    recipient: NotificationRecipient,
    payload: NotificationPayload,
    channels?: NotificationChannel[],
    options?: NotifyOptions,
  ): UntimedSchedule {
    return new Schedule(async () => {
      try {
        const { notify } = await import('@stacksjs/notifications')
        const results = await notify(recipient, payload, channels, options)
        const failed = results.filter(result => !result.success)
        if (failed.length > 0) {
          const reasons = failed.map(result => `${result.channel}: ${result.error?.message ?? 'not delivered'}`).join('; ')
          throw new Error(`Scheduled notification was not delivered on ${failed.length} of ${results.length} channel(s) - ${reasons}`)
        }
      }
      catch (error) {
        log.error('Scheduled notification failed:', error)
        throw error
      }
    }).withName(notificationTaskName(recipient, payload, channels, options)) as UntimedSchedule
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
    Schedule.inProcessRuns.clear()
    Schedule.scheduledKeys.clear()
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
