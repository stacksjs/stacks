import { formatDate } from '@stacksjs/orm'
import { getDb } from '../database'

/**
 * Flip due `scheduled` pages to `published`. `published_at` is stamped at
 * flip time (not the scheduled time) so the row records when the page
 * actually went live. Run every minute by the default
 * `PublishScheduledPages` job; returns how many pages went live.
 */
export async function publishDuePages(now: Date = new Date()): Promise<number> {
  const db = await getDb()
  const cutoff = formatDate(now)

  const due = await db
    .selectFrom('pages')
    .where('status', '=', 'scheduled')
    .where('scheduled_at', 'is not', null)
    .where('scheduled_at', '<=', cutoff)
    .select(['id'])
    .execute() as { id: number }[]

  if (due.length === 0)
    return 0

  await db
    .updateTable('pages')
    .set({
      status: 'published',
      published_at: cutoff,
      updated_at: cutoff,
    })
    .where('id', 'in', due.map(row => row.id))
    .execute()

  return due.length
}
