/// <reference path="./bun-cron.d.ts" />

export * from './types'
export { parseCron } from './parser'

import { parseCron } from './parser'

// Parse a cron expression and return the next matching Date, in UTC unless
// `options.tz` names a zone.
//
// Examples:
//   parse('0 0 * * *')          → next midnight UTC
//   parse('@hourly')            → next hour
//   parse('0,15,30,45 * * * *') → next 15-min mark
//
// Not `Bun.cron.parse`, though it exists. That one answers in the process's
// local time, as crontab does, so handing it the call made "midnight" mean
// midnight UTC on a UTC server and midnight wherever the server was otherwise.
// The scheduler's UTC path calls this without a `tz`, so a UTC app on a New
// York box ran its daily tasks at 05:00 UTC.
export function parse(expression: string, relativeDate?: Date | number, options: import('./parser').ParseCronOptions = {}): Date | null {
  return parseCron(expression, relativeDate, options)
}

/**
 * Register an OS-level cron job that persists across process restarts.
 *
 * Requires Bun's native cron support (crontab on Linux, launchd on macOS,
 * schtasks on Windows).
 *
 * The target script must export a `scheduled(controller)` handler:
 * ```ts
 * export default {
 *   async scheduled(controller) {
 *     // controller.cron, controller.scheduledTime
 *     await doWork()
 *   }
 * }
 * ```
 *
 * @param path - Path to the script to run
 * @param schedule - Cron expression or nickname (@daily, @hourly, etc.)
 * @param title - Unique job identifier (alphanumeric, hyphens, underscores)
 */
export async function register(path: string, schedule: string, title: string): Promise<void> {
  if (typeof Bun === 'undefined' || !Bun.cron) {
    throw new Error('Bun.cron is not available. OS-level cron requires a Bun version with native cron support.')
  }

  await Bun.cron(path, schedule, title)
}

/**
 * Remove a previously registered OS-level cron job.
 *
 * @param title - The title of the cron job to remove
 */
export async function remove(title: string): Promise<void> {
  if (typeof Bun === 'undefined' || !Bun.cron?.remove) {
    throw new Error('Bun.cron is not available. OS-level cron requires a Bun version with native cron support.')
  }

  await Bun.cron.remove(title)
}
