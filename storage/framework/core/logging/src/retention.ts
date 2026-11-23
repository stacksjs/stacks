import { readdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * How many days of daily log files are kept when nothing says otherwise.
 *
 * The logger writes one `stacks-YYYY-MM-DD.log` a day, and nothing ever
 * deleted one: a project's storage/logs held 120 of them, back eight months
 * (stacksjs/stacks#3365).
 */
export const DEFAULT_LOG_RETENTION_DAYS = 14

/** A daily file the logger writes, and the day it covers. */
const DAILY_LOG = /^stacks-(\d{4}-\d{2}-\d{2})\.log$/

const DAY_MS = 86_400_000

/**
 * The retention window in days: `LOG_RETENTION_DAYS`, then `config/logging.ts`'s
 * `retentionDays`, then 14. `0` keeps every file. A value that is not a whole
 * number of days is ignored rather than obeyed.
 */
export function resolveRetentionDays(input: { env?: string, cfg?: unknown }): number {
  const whole = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined
  const fromEnv = input.env !== undefined && /^\d+$/.test(input.env.trim()) ? Number(input.env.trim()) : undefined
  return fromEnv ?? whole(input.cfg) ?? DEFAULT_LOG_RETENTION_DAYS
}

/**
 * Delete the daily log files in `directory` older than `retentionDays` days,
 * returning their names. Only `stacks-YYYY-MM-DD.log` files are considered:
 * `stacks.log`, other channels' files and anything an app put there are left
 * alone. A file is kept through the whole of its last day.
 */
export async function pruneDailyLogs(directory: string, retentionDays: number, now: Date = new Date()): Promise<string[]> {
  if (retentionDays <= 0)
    return []

  let files: string[]
  try {
    files = await readdir(directory)
  }
  catch {
    return []
  }

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const oldest = today - retentionDays * DAY_MS
  const deleted: string[] = []
  for (const file of files) {
    const day = DAILY_LOG.exec(file)?.[1]
    if (!day)
      continue
    const covered = Date.parse(`${day}T00:00:00Z`)
    if (Number.isNaN(covered) || covered >= oldest)
      continue
    try {
      await unlink(join(directory, file))
      deleted.push(file)
    }
    catch {
      // Already gone, or not ours to remove: retention is best effort.
    }
  }
  return deleted
}

let retentionTimer: ReturnType<typeof setInterval> | undefined
let retained: { directory: string, days: number } | undefined

/**
 * Prune now and once a day after, for as long as the process runs. Calling
 * it again (a rebuilt logger) updates the directory and window rather than
 * starting a second timer. The timer does not keep the process alive.
 */
export function keepDailyLogsFor(directory: string, retentionDays: number): void {
  retained = { directory, days: retentionDays }
  void pruneDailyLogs(directory, retentionDays).catch(() => {})
  if (retentionTimer)
    return
  retentionTimer = setInterval(() => {
    if (retained)
      void pruneDailyLogs(retained.directory, retained.days).catch(() => {})
  }, DAY_MS)
  ;(retentionTimer as { unref?: () => void }).unref?.()
}
