import type { CatchCallbackFn } from '@stacksjs/cron'
import type { ScheduledJob, TimedSchedule, Timezone, UntimedSchedule } from './types'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { runAction } from '@stacksjs/actions'
import { log, runCommand } from '@stacksjs/cli'
import { parse } from '@stacksjs/cron'
import { runJob } from '@stacksjs/queue'
import type { SchedulerLockHandle } from './scheduler-lock'
import { acquireSchedulerLock } from './scheduler-lock'

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
  private static activeLocks = new Map<string, SchedulerLockHandle>()
  private shouldPreventOverlap = false
  private overlapExpiresAfterMinutes = 24 * 60
  private shouldRunOnOneServer = false
  private shouldRunInBackground = false
  /** stdout/stderr redirect target (S-3). Null = no capture. */
  private outputPath: string | null = null
  /** When true, append to outputPath; otherwise overwrite per run. */
  private outputAppend = false
  private options: {
    timezone?: string
    catch?: CatchCallbackFn
    maxRuns?: number
    protect?: boolean | ((_job: ScheduledJob) => void)
    name?: string
    context?: any
    interval?: number
    startAt?: string | Date
    stopAt?: string | Date
  } = {}

  constructor(task: () => void) {
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
    if (parts.length !== 2) {
      throw new Error(`Invalid time format "${time}". Expected "HH:MM" (e.g., "14:30")`)
    }
    const [hour, minute] = parts.map(Number) as [number | undefined, number | undefined]
    if (hour === undefined || minute === undefined || Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw new Error(`Invalid time "${time}". Hour must be 0-23, minute must be 0-59`)
    }
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

    const slots: Date[] = []
    // parseCron's internal search starts from `relativeDate`'s next
    // minute, so passing `since` as-is correctly finds the first
    // matching slot AFTER `since`. Right-boundary is INCLUSIVE
    // (`> now`, not `>= now`) so a slot whose minute matches "now"
    // is treated as missed too — common case after a server boot
    // where the scheduler's first tick lands a fraction of a second
    // after a cron slot. We capture +1 over `max` so the cap-warn
    // below knows whether we overflowed.
    let cursor = since
    while (slots.length < max + 1) {
      const next = parse(this.cronPattern, cursor)
      if (!next || next.getTime() > now) break
      slots.push(next)
      cursor = next.getTime()
    }

    if (slots.length > max) {
      log.warn(`[scheduler] runMissed: ${slots.length} missed slots since ${new Date(since).toISOString()}, capping at ${max} — older runs dropped`)
      slots.splice(0, slots.length - max)
    }

    let fired = 0
    for (const slot of slots) {
      try {
        const result = this.task() as unknown
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
  static listJobs(): Array<{ name: string, pattern?: string, timezone?: Timezone, nextRun: Date | null }> {
    const out: Array<{ name: string, pattern?: string, timezone?: Timezone, nextRun: Date | null }> = []
    for (const [name, job] of Schedule.jobs) {
      out.push({
        name,
        pattern: job.pattern,
        timezone: job.timezone,
        nextRun: job.nextRun ? job.nextRun() : null,
      })
    }
    return out
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
        const { db } = await import('@stacksjs/database')
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

  private wrapTask(originalTask: () => void): () => void {
    const taskName = this.options.name || 'unnamed-task'
    let wrappedTask = originalTask

    if (this.shouldPreventOverlap || this.shouldRunOnOneServer) {
      const self = this
      const innerTask = wrappedTask
      // Lock acquisition is async now (DB advisory lock can require a
      // round-trip) but cron ticks are sync. Run the lock acquire in
      // the background and gate execution behind it — if acquire
      // fails, log + skip; if it succeeds, run + release in finally.
      wrappedTask = () => {
        void (async () => {
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
          catch (error) {
            log.error(`[scheduler] task ${taskName} threw: ${error instanceof Error ? error.message : String(error)}`)
          }
          finally {
            await self.releaseLock(taskName)
          }
        })()
      }
    }

    if (this.shouldRunInBackground) {
      const innerTask = wrappedTask
      const outputPath = this.outputPath
      const outputAppend = this.outputAppend
      wrappedTask = () => {
        // Capture stdout + stderr to a log file when one's configured
        // (stacksjs/stacks#1877 S-2 + S-3). Previously `stdio: 'ignore'`
        // dropped every byte from the child — a crashing background
        // task produced no signal at all. Now: redirect to the user's
        // `.sendOutputTo(path)` target when set, otherwise pipe to
        // the parent process's stderr so at least the launching
        // operator sees the failure.
        let stdoutFd: number | 'inherit' = 'inherit'
        let stderrFd: number | 'inherit' = 'inherit'
        let closeFd: number | null = null
        if (outputPath) {
          try {
            // Lazy-import to keep the sync prelude small; spawn is
            // already from node:child_process at module-load time.
            // eslint-disable-next-line ts/no-require-imports
            const { openSync } = require('node:fs') as typeof import('node:fs')
            const fd = openSync(outputPath, outputAppend ? 'a' : 'w')
            stdoutFd = fd
            stderrFd = fd
            closeFd = fd
          }
          catch (err) {
            log.warn(`[scheduler] couldn't open ${outputPath} for background task ${taskName}: ${err instanceof Error ? err.message : String(err)}; falling back to inherit`)
          }
        }

        const child = spawn(process.execPath, ['-e', `(${innerTask.toString()})()`], {
          detached: true,
          stdio: ['ignore', stdoutFd, stderrFd],
        })
        child.on('error', (error) => {
          log.error(`Background task ${taskName} failed to spawn: ${error.message}`)
          if (closeFd !== null) {
            try {
              // eslint-disable-next-line ts/no-require-imports
              const { closeSync } = require('node:fs') as typeof import('node:fs')
              closeSync(closeFd)
            }
            catch {
              // Already closed — fine.
            }
          }
        })
        // Crash visibility (stacksjs/stacks#1877 S-2). Before this
        // listener, a child that exited with a non-zero code was
        // silently lost — `.unref()` releases the child to the OS
        // and the scheduler moves on. Now: log the exit code so
        // operators see the failure in logs and can match it to
        // the task name.
        child.on('exit', (code, signal) => {
          if (code !== 0 && code !== null) {
            log.error(`[scheduler] background task ${taskName} (pid: ${child.pid}) exited with code ${code}`)
          }
          else if (signal) {
            log.warn(`[scheduler] background task ${taskName} (pid: ${child.pid}) terminated by signal ${signal}`)
          }
          if (closeFd !== null) {
            try {
              // eslint-disable-next-line ts/no-require-imports
              const { closeSync } = require('node:fs') as typeof import('node:fs')
              closeSync(closeFd)
            }
            catch {
              // Already closed — fine.
            }
          }
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
    return parse(this.cronPattern, undefined, { tz: this.timezone })
  }

  private start(): ScheduledJob {
    if (!this.cronPattern && this.intervalMs === null) {
      return { stop: () => {}, nextRun: () => null }
    }

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

    const job: ScheduledJob = {
      stop,
      nextRun,
      pattern: this.intervalMs !== null ? `every ${this.intervalMs / 1000}s` : this.cronPattern,
      timezone: this.timezone,
      name: this.options.name,
    }

    const taskName = this.options.name || 'unnamed-task'
    const executeTask = () => {
      if (this.options.maxRuns && runCount >= this.options.maxRuns) {
        stop()
        return
      }
      runCount++
      try {
        const result = task() as unknown
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
        if (result && typeof (result as Promise<unknown>).then === 'function') {
          (result as Promise<unknown>).catch((error: unknown) => {
            if (this.options.catch) {
              this.options.catch(error as Error)
            }
            else {
              // No user catch installed — log so the rejection is
              // at least visible. Previously a missing catch + a
              // rejecting task = silent failure.
              log.error(`[scheduler] task ${taskName} async error (no .catch handler installed): ${error instanceof Error ? error.message : String(error)}`)
            }
          })
        }
      }
      catch (error) {
        if (this.options.catch) {
          this.options.catch(error as Error)
        }
        else {
          log.error(`[scheduler] task ${taskName} sync error (no .catch handler installed): ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }

    if (this.intervalMs !== null) {
      // Sub-minute scheduling (everySecond): use setInterval.
      // .unref() so the timer doesn't pin the event loop open after
      // every other work item finishes — without this, a CLI script
      // that registers a `.everySecond()` schedule blocks the process
      // from exiting cleanly.
      timer = setInterval(() => {
        if (stopped) return
        executeTask()
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
        if (!nextTime) return

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
            executeTask()
            scheduleNext()
          }, delay)
        }
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
    return instance.withName(`command-${cmd}`) as UntimedSchedule
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
