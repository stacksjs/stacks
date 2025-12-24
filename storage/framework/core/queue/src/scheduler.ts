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
 * Parse a cron expression and check if it should run now
 */
function shouldRunNow(cronExpression: string, lastRun: Date | null): boolean {
  const now = new Date()
  const currentMinute = now.getMinutes()
  const currentHour = now.getHours()
  const currentDay = now.getDate()
  const currentMonth = now.getMonth() + 1
  const currentDayOfWeek = now.getDay()

  // Skip if already run this minute
  if (lastRun) {
    const lastMinute = lastRun.getMinutes()
    const lastHour = lastRun.getHours()
    const lastDay = lastRun.getDate()

    if (
      lastMinute === currentMinute
      && lastHour === currentHour
      && lastDay === currentDay
    ) {
      return false
    }
  }

  // Parse cron expression (minute hour day month dayOfWeek)
  const parts = cronExpression.trim().split(/\s+/)

  if (parts.length < 5) {
    log.warn(`Invalid cron expression: ${cronExpression}`)
    return false
  }

  const [minute, hour, day, month, dayOfWeek] = parts

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
function matchesCronPart(part: string, current: number, min: number, max: number): boolean {
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
    const [start, end] = part.split('-').map(v => Number.parseInt(v.trim(), 10))
    return current >= start && current <= end
  }

  // Step (e.g., "*/5")
  if (part.includes('/')) {
    const [range, step] = part.split('/')
    const stepNum = Number.parseInt(step, 10)

    if (range === '*') {
      return current % stepNum === 0
    }

    if (range.includes('-')) {
      const [start, end] = range.split('-').map(v => Number.parseInt(v.trim(), 10))
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
  if (scheduleMap[schedule.toLowerCase()]) {
    return scheduleMap[schedule.toLowerCase()]
  }

  // Check for "Every" expressions
  const everyMatch = schedule.match(/^Every\.(\w+)$/i)
  if (everyMatch) {
    const interval = everyMatch[1].toLowerCase()
    const everyMap: Record<string, string> = {
      minute: '* * * * *',
      fiveminutes: '*/5 * * * *',
      tenminutes: '*/10 * * * *',
      fifteenminutes: '*/15 * * * *',
      thirtyminutes: '*/30 * * * *',
      hour: '0 * * * *',
      day: '0 0 * * *',
      week: '0 0 * * 0',
      month: '0 0 1 * *',
    }
    return everyMap[interval] || null
  }

  // Assume it's already a cron expression
  if (schedule.split(/\s+/).length >= 5) {
    return schedule
  }

  return null
}

/**
 * Calculate next run time for a cron expression
 */
function calculateNextRun(cronExpression: string): Date | null {
  const now = new Date()
  const parts = cronExpression.trim().split(/\s+/)

  if (parts.length < 5) {
    return null
  }

  // Simple calculation: add 1 minute and check
  // For more accurate calculation, you'd need a proper cron parser
  const next = new Date(now.getTime() + 60000)
  next.setSeconds(0)
  next.setMilliseconds(0)

  return next
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
        schedulerState.jobs.set(job.name, {
          job,
          lastRun: null,
          nextRun: calculateNextRun(cronExpression),
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

  // Start checking
  schedulerState.checkInterval = setInterval(() => {
    if (!schedulerState.isShuttingDown) {
      checkScheduledJobs()
    }
  }, schedulerState.config.checkInterval)

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

    // Check if job should run
    if (shouldRunNow(cronExpression, state.lastRun)) {
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
        state.nextRun = calculateNextRun(cronExpression)

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
    clearInterval(schedulerState.checkInterval)
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
