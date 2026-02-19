/// <reference path="./bun-cron.d.ts" />

export * from './types'
export { parseCron } from './parser'

import { parseCron } from './parser'

// Parse a cron expression and return the next matching Date.
// Uses Bun's native cron parser when available, otherwise falls back
// to our own 5-field parser with identical behavior.
//
// Examples:
//   parse('0 0 * * *')          → next midnight UTC
//   parse('@hourly')            → next hour
//   parse('0,15,30,45 * * * *') → next 15-min mark
export function parse(expression: string, relativeDate?: Date | number): Date | null {
  // Use native Bun.cron.parse when available (ships with Bun.cron PR)
  if (typeof Bun !== 'undefined' && Bun.cron?.parse) {
    return Bun.cron.parse(expression, relativeDate)
  }

  return parseCron(expression, relativeDate)
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
