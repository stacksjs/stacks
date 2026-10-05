/**
 * Job Scheduler for Stacks
 *
 * Handles cron-based job scheduling with support for:
 * - Cron expression parsing
 * - Timezone support
 * - Overlapping prevention
 * - Job dispatching
 */

import { parseCron } from '@stacksjs/cron'
import { log } from '@stacksjs/logging'
import { discoverJobs, getScheduledJobs, type DiscoveredJob } from './discovery'
import { emitQueueEvent } from './events'
import { hasUnfinishedRun, loadPersistedLastRun, persistLastRun } from './scheduler-persistence'
import { storeJob } from './utils'

/**
 * Scheduler configuration
 */
interface SchedulerConfig {
  /** Check interval in milliseconds (default: 60000 = 1 minute) */
  checkInterval: number
  /** Timezone for cron expressions (default: system timezone) */
  timezone?: string
  /** Prevent overlapping job execution */
  preventOverlapping: boolean
}

/**
 * Scheduled job state
 */
interface ScheduledJobState {
  job: DiscoveredJob
  lastRun: Date | null
  nextRun: Date | null
  isRunning: boolean
}

/**
 * Scheduler state
 */
interface SchedulerState {
  isRunning: boolean
  isShuttingDown: boolean
  checkInterval: ReturnType<typeof setInterval> | null
  jobs: Map<string, ScheduledJobState>
  config: SchedulerConfig
}

const DEFAULT_CONFIG: SchedulerConfig = {
  checkInterval: 60000, // 1 minute
  preventOverlapping: true,
}

const schedulerState: SchedulerState = {
  isRunning: false,
  isShuttingDown: false,
  checkInterval: null,
  jobs: new Map(),
  config: { ...DEFAULT_CONFIG },
}

interface CronParts { minute: number, hour: number, day: number, month: number, dayOfWeek: number }

let warnedBadTimezone = false

// Cache one Intl.DateTimeFormat per timezone. getCronParts runs per-job-per-tick
// and inside calculateNextRun's minute-walk, so re-constructing a formatter each
// call would be needlessly expensive.
const tzFormatterCache = new Map<string, Intl.DateTimeFormat>()
function tzFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = tzFormatterCache.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
    })
    tzFormatterCache.set(timeZone, f)
  }
  return f
}

/**
 * Extract the wall-clock fields a cron expression matches against, in the
 * configured timezone (stacksjs/stacks#1984). `SchedulerConfig.timezone` was
 * documented ("Timezone for cron expressions") but never applied — cron ran in
 * the server's local time regardless, so `0 9 * * *` fired at 9am server-local
 * rather than 9am in the configured zone. With no timezone set we keep
 * local-time semantics; an invalid zone warns once and falls back to local.
 */
export function getCronParts(date: Date, timeZone?: string): CronParts {
  if (timeZone && timeZone !== 'local' && timeZone !== 'system') {
    try {
      const parts = tzFormatter(timeZone).formatToParts(date)
      const get = (t: string): string => parts.find(p => p.type === t)?.value ?? ''
      const weekday: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
      let hour = Number(get('hour'))
      if (hour === 24)
        hour = 0 // some engines emit '24' for midnight under hour12:false
      return {
        minute: Number(get('minute')),
        hour,
        day: Number(get('day')),
        month: Number(get('month')),
        dayOfWeek: weekday[get('weekday')] ?? date.getDay(),
      }
    }
    catch {
      if (!warnedBadTimezone) {
        warnedBadTimezone = true
        log.warn(`[scheduler] Invalid timezone "${timeZone}"; falling back to system local time.`)
      }
    }
  }
  return {
    minute: date.getMinutes(),
    hour: date.getHours(),
    day: date.getDate(),
    month: date.getMonth() + 1,
    dayOfWeek: date.getDay(),
  }
}

/**
 * The zone a cron expression is read in: the configured one, or this
 * machine's, which is what an unconfigured scheduler has always used.
 * An invalid zone warns once and falls back the same way.
 */
function cronTimeZone(timeZone?: string): string {
  const system = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (!timeZone || timeZone === 'local' || timeZone === 'system')
    return system
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return timeZone
  }
  catch {
    if (!warnedBadTimezone) {
      warnedBadTimezone = true
      log.warn(`[scheduler] Invalid timezone "${timeZone}"; falling back to system local time.`)
    }
    return system
  }
}

const warnedInvalidCron = new Set<string>()

/**
 * The first minute at or after `from` that `cronExpression` matches.
 *
 * Through @stacksjs/cron, which implements cron rather than approximating it.
 * The matcher that used to be here checked `-` before `/`, so `0-30/10` read
 * as "0 to 30" and fired every minute of it; parsed each list item as a bare
 * integer, so `1-5,30` meant `1,30`; and ANDed day-of-month with day-of-week,
 * where cron ORs them when both are restricted.
 */
function nextCronMinute(cronExpression: string, from: Date, timeZone?: string): Date | null {
  try {
    // parseCron searches from the minute AFTER its base.
    return parseCron(cronExpression, from.getTime() - 60_000, { tz: cronTimeZone(timeZone) })
  }
  catch (error) {
    if (!warnedInvalidCron.has(cronExpression)) {
      warnedInvalidCron.add(cronExpression)
      log.warn(`Invalid cron expression: ${cronExpression} (${error instanceof Error ? error.message : String(error)})`)
    }
    return null
  }
}

export function shouldRunNow(cronExpression: string, lastRun: Date | null, timeZone?: string): boolean {
  const minute = new Date()
  minute.setSeconds(0, 0)

  // Already run this minute. The whole instant, not its wall-clock fields:
  // comparing minute, hour and day only made a monthly job's run on the 1st
  // at 00:00 look like "already ran" a month later, on the next 1st at 00:00,
  // so it ran once and never again - and the marker survives restarts.
  if (lastRun && Math.floor(lastRun.getTime() / 60_000) === Math.floor(minute.getTime() / 60_000))
    return false

  return nextCronMinute(cronExpression, minute, timeZone)?.getTime() === minute.getTime()
}

/**
 * Parse common schedule strings
 */
function parseScheduleString(schedule: string): string | null {
  const scheduleMap: Record<string, string> = {
    '@yearly': '0 0 1 1 *',
    '@annually': '0 0 1 1 *',
    '@monthly': '0 0 1 * *',
    '@weekly': '0 0 * * 0',
    '@daily': '0 0 * * *',
    '@midnight': '0 0 * * *',
    '@hourly': '0 * * * *',
  }

  // Check for predefined schedules
  const mapped = scheduleMap[schedule.toLowerCase()]
  if (mapped) {
    return mapped
  }

  // Check for "Every" expressions
  const everyMatch = schedule.match(/^Every\.(\w+)$/i)
  if (everyMatch && everyMatch[1] !== undefined) {
    const interval = everyMatch[1].toLowerCase()
    const everyMap: Record<string, string> = {
      second: '* * * * *', // sub-minute not supported, run every minute
      fiveseconds: '* * * * *',
      tenseconds: '* * * * *',
      thirtyseconds: '* * * * *',
      minute: '* * * * *',
      fiveminutes: '*/5 * * * *',
      tenminutes: '*/10 * * * *',
      fifteenminutes: '*/15 * * * *',
      thirtyminutes: '*/30 * * * *',
      hour: '0 * * * *',
      twohours: '0 */2 * * *',
      sixhours: '0 */6 * * *',
      twelvehours: '0 */12 * * *',
      day: '0 0 * * *',
      week: '0 0 * * 0',
      month: '0 0 1 * *',
    }
    return everyMap[interval] || null
  }

  // Assume it's already a cron expression (5 or 6 parts)
  const partCount = schedule.split(/\s+/).length
  if (partCount >= 5 && partCount <= 6) {
    return schedule
  }

  return null
}

/**
 * Calculate next run time for a cron expression
 */
export function calculateNextRun(cronExpression: string, timeZone?: string): Date | null {
  const next = new Date()
  next.setSeconds(0, 0)
  next.setTime(next.getTime() + 60_000)
  return nextCronMinute(cronExpression, next, timeZone)
}

/**
 * Start the scheduler
 */
export async function startScheduler(config: Partial<SchedulerConfig> = {}): Promise<void> {
  if (schedulerState.isRunning) {
    log.warn('Scheduler is already running')
    return
  }

  schedulerState.config = { ...DEFAULT_CONFIG, ...config }
  schedulerState.isRunning = true
  schedulerState.isShuttingDown = false

  // Discover jobs
  await discoverJobs()

  // Register scheduled jobs
  const scheduledJobs = getScheduledJobs()

  for (const job of scheduledJobs) {
    const schedule = job.config.rate || job.config.schedule

    if (schedule) {
      const cronExpression = parseScheduleString(schedule)

      if (cronExpression) {
        // Seed lastRun from persistence (stacksjs/stacks#1984) so a restart
        // within the same clock-minute a job fires doesn't re-dispatch it.
        // Falls back to null (today's behavior) when persistence is
        // unavailable.
        const lastRun = await loadPersistedLastRun(job.name)
        schedulerState.jobs.set(job.name, {
          job,
          lastRun,
          nextRun: calculateNextRun(cronExpression, schedulerState.config.timezone),
          isRunning: false,
        })
        log.info(`Registered scheduled job: ${job.name} (${cronExpression})`)
      }
      else {
        log.warn(`Invalid schedule for job ${job.name}: ${schedule}`)
      }
    }
  }

  if (schedulerState.jobs.size === 0) {
    log.info('No scheduled jobs found')
    return
  }

  log.info(`Scheduler started with ${schedulerState.jobs.size} job(s)`)

  // Setup graceful shutdown
  process.on('SIGINT', () => stopScheduler())
  process.on('SIGTERM', () => stopScheduler())

  // Start checking with a self-rescheduling timer aligned to the top of each
  // interval, instead of a plain setInterval (stacksjs/stacks#1984). A fixed
  // setInterval is not drift-corrected and each tick adds async work, so ticks
  // slowly slip; once a tick lands off the cron minute (e.g. HH:31:xx for a
  // `30 * * * *` job) that run is skipped entirely, and accumulated drift
  // eventually drops a daily job on some days. Re-arming to `interval - (now %
  // interval)` keeps every wall-clock minute covered.
  let isChecking = false
  const scheduleNextTick = (): void => {
    if (schedulerState.isShuttingDown)
      return
    const interval = schedulerState.config.checkInterval
    const delay = interval - (Date.now() % interval)
    schedulerState.checkInterval = setTimeout(() => {
      if (!schedulerState.isShuttingDown && !isChecking) {
        isChecking = true
        checkScheduledJobs()
          .catch(err => log.error('Scheduler check failed:', err))
          .finally(() => { isChecking = false })
      }
      scheduleNextTick()
    }, delay)
    // Without .unref(), this timer keeps the event loop alive — every CLI
    // command that imports scheduler keeps Bun running indefinitely even after
    // the command logic returned. .unref() lets the process exit when nothing
    // else is pending.
    schedulerState.checkInterval?.unref?.()
  }
  scheduleNextTick()

  // Run initial check
  await checkScheduledJobs()
}

/**
 * Check and run scheduled jobs
 */
async function checkScheduledJobs(): Promise<void> {
  for (const [name, state] of schedulerState.jobs) {
    const schedule = state.job.config.rate || state.job.config.schedule

    if (!schedule) continue

    const cronExpression = parseScheduleString(schedule)
    if (!cronExpression) continue

    // Check if job should run (in the configured timezone, if any)
    if (shouldRunNow(cronExpression, state.lastRun, schedulerState.config.timezone)) {
      // Overlap guards ask the QUEUE, not `state.isRunning` (stacksjs/stacks#1984).
      // The scheduler only enqueues: it set `isRunning` right before `storeJob`
      // and cleared it right after, so the flag described the enqueue rather
      // than the execution and was always false again by the next tick. Both
      // guards therefore never fired. `hasUnfinishedRun` checks whether the
      // previously dispatched job row is still there, which is what "previous
      // execution still running" actually means.
      //
      // Only asked when a guard is on, so the default path adds no query.
      const overlapGuarded = schedulerState.config.preventOverlapping || state.job.config.withoutOverlapping
      if (overlapGuarded && await hasUnfinishedRun(name)) {
        log.debug(`Skipping ${name}: previous execution still running`)
        continue
      }

      // Re-entrancy guard for the enqueue itself. Narrow on purpose — the
      // overlap question above is the one about execution.
      if (state.isRunning) {
        log.debug(`Skipping ${name}: a dispatch for it is already in flight`)
        continue
      }

      // Dispatch the job
      try {
        state.isRunning = true
        state.lastRun = new Date()
        state.nextRun = calculateNextRun(cronExpression, schedulerState.config.timezone)

        // Persist the run marker so a restart this minute won't re-dispatch
        // (stacksjs/stacks#1984). Best-effort; matches the in-memory guard's
        // "marked at dispatch time" semantics.
        await persistLastRun(name, state.lastRun)

        log.info(`Dispatching scheduled job: ${name}`)

        await emitQueueEvent('job:added', {
          jobId: `scheduled-${name}-${Date.now()}`,
          queueName: state.job.config.queue || 'default',
          jobName: name,
        })

        // Store job in queue
        await storeJob(name, scheduledDispatchOptions(state.job.config))

        // Mark as not running after dispatch (the queue worker will handle execution)
        state.isRunning = false

        log.info(`Scheduled job ${name} dispatched to queue`)
      }
      catch (error) {
        state.isRunning = false
        log.error(`Failed to dispatch scheduled job ${name}:`, error)
      }
    }
  }
}

/**
 * Stop the scheduler
 */
export async function stopScheduler(): Promise<void> {
  if (!schedulerState.isRunning) {
    return
  }

  log.info('Stopping scheduler...')
  schedulerState.isShuttingDown = true

  if (schedulerState.checkInterval) {
    // The tick is now a self-rescheduling setTimeout; isShuttingDown (set
    // above) stops it from re-arming, and clearTimeout cancels the pending one.
    clearTimeout(schedulerState.checkInterval)
    schedulerState.checkInterval = null
  }

  schedulerState.isRunning = false
  schedulerState.jobs.clear()

  log.info('Scheduler stopped')
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): {
  isRunning: boolean
  jobCount: number
  jobs: Array<{
    name: string
    schedule: string | undefined
    lastRun: Date | null
    nextRun: Date | null
    isRunning: boolean
  }>
} {
  return {
    isRunning: schedulerState.isRunning,
    jobCount: schedulerState.jobs.size,
    jobs: Array.from(schedulerState.jobs.entries()).map(([name, state]) => ({
      name,
      schedule: state.job.config.rate || state.job.config.schedule,
      lastRun: state.lastRun,
      nextRun: state.nextRun,
      isRunning: state.isRunning,
    })),
  }
}

/**
 * Check if scheduler is running
 */
export function isSchedulerRunning(): boolean {
  return schedulerState.isRunning
}

/**
 * Get registered scheduled jobs
 */
export function getRegisteredJobs(): Map<string, ScheduledJobState> {
  return new Map(schedulerState.jobs)
}

/**
 * Manually trigger a scheduled job
 */
export async function triggerJob(name: string): Promise<void> {
  const state = schedulerState.jobs.get(name)

  if (!state) {
    throw new Error(`Scheduled job "${name}" not found`)
  }

  log.info(`Manually triggering scheduled job: ${name}`)

  await storeJob(name, scheduledDispatchOptions(state.job.config))
}

/**
 * What a scheduled run is queued with: the job's own settings.
 *
 * `timeout: config.timeout || 60` gave every scheduled job that declared no
 * timeout a 60-second one - a nightly export that takes five minutes was
 * failed at one and retried while the first run was still going. And the
 * job's `backoff` was never passed at all.
 */
export function scheduledDispatchOptions(config: { queue?: string, tries?: number, timeout?: number, backoff?: number | number[] | unknown }): Parameters<typeof storeJob>[1] {
  const backoff = config.backoff
  return {
    queue: config.queue || 'default',
    payload: {},
    maxTries: config.tries ?? 3,
    timeout: config.timeout,
    backoff: typeof backoff === 'number' || Array.isArray(backoff) ? backoff as number | number[] : undefined,
  }
}
