import { Action } from '@stacksjs/actions'

/**
 * GET /api/buddy/schedule
 *
 * Snapshot of every registered scheduled task — pattern, last run,
 * next run, status — for the admin dashboard's schedule view.
 *
 * Reads from the queue/database scheduler's `scheduled_jobs` table
 * if it exists, falling back to an empty list otherwise so the
 * dashboard doesn't 500 on apps that don't use scheduled jobs.
 */
export default new Action({
  name: 'Buddy Schedule List',
  description: 'List registered scheduled tasks with their next/last run times.',

  async handle() {
    try {
      const { db } = await import('@stacksjs/database')
      const dbAny = db as any

      const rows = await dbAny
        .selectFrom('scheduled_jobs')
        .selectAll()
        .orderBy('next_run_at', 'asc')
        .execute()

      return {
        items: (rows as Array<Record<string, unknown>>).map(row => ({
          id: String(row.id ?? ''),
          name: String(row.name ?? row.action ?? 'unnamed'),
          pattern: String(row.cron_expression ?? row.pattern ?? '?'),
          timezone: row.timezone ? String(row.timezone) : null,
          lastRunAt: row.last_run_at ? String(row.last_run_at) : null,
          nextRunAt: row.next_run_at ? String(row.next_run_at) : null,
          enabled: row.enabled !== false,
          consecutiveFailures: Number(row.consecutive_failures ?? 0),
        })),
      }
    }
    catch (err) {
      // Most common cause: the scheduled_jobs table doesn't exist
      // because the user hasn't run the scheduler migration. Return
      // an empty list with a hint instead of a 500.
      return {
        items: [],
        error: err instanceof Error ? err.message : String(err),
        hint: 'If you see "no such table: scheduled_jobs", run `buddy migrate`.',
      }
    }
  },
})
