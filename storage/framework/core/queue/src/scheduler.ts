/**
 * Job Scheduler for Stacks
 *
 * Handles cron-based job scheduling with support for:
 * - Cron expression parsing
 * - Timezone support
 * - Overlapping prevention
 * - Job dispatching
 */

import { log } from '@stacksjs/logging'
import { discoverJobs, getScheduledJobs, type DiscoveredJob } from './discovery'
import { emitQueueEvent } from './events'
import { loadPersistedLastRun, persistLastRun } from './scheduler-persistence'
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

/**
 * Once-per-expression warn that a 6-field cron's seconds component is
 * being dropped — the scheduler ticks at minute granularity, so any
 * seconds value other than `0` / `*` is silently lost. Tracking each
 * expression separately means a config that registers many 6-field
 * crons gets one warn per expression, not one per tick.
 * (stacksjs/stacks#1872 Q-12.)
 */
const _warnedSecondsExprs = new Set<string>()
function warnSecondsIgnored(expression: string, seconds: string): void {
  if (_warnedSecondsExprs.has(expression)) return
  _warnedSecondsExprs.add(expression)
  log.warn(
    `[scheduler] Cron expression "${expression}" specifies seconds="${seconds}" but the scheduler `
    + `ticks at minute granularity — the seconds field is being ignored. Use a 5-field expression `
    + `to avoid this warning, or wait for sub-minute scheduling support.`,
  )
}

/**
 * Parse a cron expression and check if it should run now
 */
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

function shouldRunNow(cronExpression: string, lastRun: Date | null, timeZone?: string): boolean {
  const now = getCronParts(new Date(), timeZone)
  const currentMinute = now.minute
  const currentHour = now.hour
  const currentDay = now.day
  const currentMonth = now.month
  const currentDayOfWeek = now.dayOfWeek

  // Skip if already run this minute (compared in the same timezone)
  if (lastRun) {
    const last = getCronParts(lastRun, timeZone)

    if (
      last.minute === currentMinute
      && last.hour === currentHour
      && last.day === currentDay
    ) {
      return false
    }
  }

  // Parse cron expression (minute hour day month dayOfWeek).
  // Also supports 6-part format (second minute hour day month dayOfWeek)
  // by stripping seconds — the scheduler's tick interval is 60s so
  // sub-minute scheduling isn't supported. Warn (once per expression)
  // when a 6-field caller asks for non-zero seconds, so they don't
  // silently lose the precision they wrote. See stacksjs/stacks#1872 Q-12.
  let parts = cronExpression.trim().split(/\s+/)

  if (parts.length === 6) {
    const seconds = parts[0]
    if (seconds && seconds !== '0' && seconds !== '*') {
      warnSecondsIgnored(cronExpression, seconds)
    }
    parts = parts.slice(1)
  }

  if (parts.length < 5) {
    log.warn(`Invalid cron expression: ${cronExpression}`)
    return false
  }

  const [minute, hour, day, month, dayOfWeek] = parts as [string, string, string, string, string]

  return (
    matchesCronPart(minute, currentMinute, 0, 59)
    && matchesCronPart(hour, currentHour, 0, 23)
    && matchesCronPart(day, currentDay, 1, 31)
    && matchesCronPart(month, currentMonth, 1, 12)
    && matchesCronPart(dayOfWeek, currentDayOfWeek, 0, 6)
  )
}

/**
 * Match a single cron part against the current value
 */
function matchesCronPart(part: string, current: number, _min: number, _max: number): boolean {
  // Wildcard
  if (part === '*') {
    return true
  }

  // List (e.g., "1,2,3")
  if (part.includes(',')) {
    const values = part.split(',').map(v => Number.parseInt(v.trim(), 10))
    return values.includes(current)
  }

  // Range (e.g., "1-5")
  if (part.includes('-')) {
    const [start, end] = part.split('-').map(v => Number.parseInt(v.trim(), 10)) as [number, number]
    return current >= start && current <= end
  }

  // Step (e.g., "*/5")
  if (part.includes('/')) {
    const [range, step] = part.split('/') as [string, string]
    const stepNum = Number.parseInt(step, 10)

    if (range === '*') {
      return current % stepNum === 0
    }

    if (range.includes('-')) {
      const [start, end] = range.split('-').map(v => Number.parseInt(v.trim(), 10)) as [number, number]
      return current >= start && current <= end && (current - start) % stepNum === 0
    }
  }

  // Exact value
  const exact = Number.parseInt(part, 10)
  return !Number.isNaN(exact) && current === exact
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
  const parts = cronExpression.trim().split(/\s+/)
  // Support the optional 6-field (seconds-prefixed) form by dropping seconds —
  // the scheduler ticks per minute, same as shouldRunNow.
  const fields = parts.length === 6 ? parts.slice(1) : parts
  if (fields.length < 5)
    return null
  const [minute, hour, day, month, dayOfWeek] = fields as [string, string, string, string, string]

  // Walk forward minute-by-minute from the next minute boundary until every
  // cron field matches, in the configured timezone (so `nextRun` lines up with
  // when the job actually fires). Bounded to ~366 days so an expression with no
  // upcoming match (e.g. a far-future Feb-29) returns null instead of looping
  // forever. Was previously a stub that always returned now+60s regardless of
  // the expression (stacksjs/stacks#1984). The tz formatter is cached, so the
  // common case (a match within a day) is a few hundred cheap iterations.
  const start = new Date()
  start.setSeconds(0, 0)
  const MAX_MINUTES = 366 * 24 * 60
  for (let i = 1; i <= MAX_MINUTES; i++) {
    const candidate = new Date(start.getTime() + i * 60_000)
    const p = getCronParts(candidate, timeZone)
    if (
      matchesCronPart(minute, p.minute, 0, 59)
      && matchesCronPart(hour, p.hour, 0, 23)
      && matchesCronPart(day, p.day, 1, 31)
      && matchesCronPart(month, p.month, 1, 12)
      && matchesCronPart(dayOfWeek, p.dayOfWeek, 0, 6)
    ) {
      return candidate
    }
  }
  return null
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
      // Check overlapping
      if (schedulerState.config.preventOverlapping && state.isRunning) {
        log.debug(`Skipping ${name}: previous execution still running`)
        continue
      }

      // Check job-level overlapping setting
      if (state.job.config.withoutOverlapping && state.isRunning) {
        log.debug(`Skipping ${name}: withoutOverlapping is enabled`)
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
        await storeJob(name, {
          queue: state.job.config.queue || 'default',
          payload: {},
          maxTries: state.job.config.tries || 3,
          timeout: state.job.config.timeout || 60,
        })

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

  await storeJob(name, {
    queue: state.job.config.queue || 'default',
    payload: {},
    maxTries: state.job.config.tries || 3,
    timeout: state.job.config.timeout || 60,
  })
}
