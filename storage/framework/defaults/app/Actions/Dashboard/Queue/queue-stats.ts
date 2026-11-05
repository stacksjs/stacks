import { db } from '@stacksjs/database/runtime'

/** One queue's jobs, as the Queue page shows them. */
export interface QueueCounts {
  name: string
  /** Waiting for a worker, delayed or not. */
  pending: number
  /** Reserved by a worker. */
  active: number
  /** Rows in `failed_jobs` for this queue. */
  failed: number
  total: number
}

const queueName = (value: unknown): string => String(value || 'default')

/**
 * Every queue that has jobs, counted by the database (stacksjs/stacks#3200).
 *
 * This read every row of `jobs` and `failed_jobs`, payloads included, to count
 * them per queue, on every visit to the Queue page. A job is active when a
 * worker has reserved it, which is `queuedJobState`'s rule in
 * `@stacksjs/queue`: a `reserved_at` that is set and not 0, so the filter
 * below is `!= 0`, which NULL never matches. Queues are listed in the order of
 * their first job, and a queue with only failures is not listed, as before.
 */
export async function readQueueCounts(database: typeof db = db): Promise<QueueCounts[]> {
  const [jobRows, failedRows] = await Promise.all([
    database.selectFrom('jobs')
      .select([
        'queue',
        database.fn.count('id').as('total'),
        database.fn.count('id').filterWhere('reserved_at', '!=', 0).as('active'),
        database.fn.min('id').as('first_id'),
      ])
      .groupBy('queue')
      .execute() as Promise<Array<{ queue: unknown, total: unknown, active: unknown, first_id: unknown }>>,
    database.selectFrom('failed_jobs')
      .select(['queue', database.fn.count('id').as('failed')])
      .groupBy('queue')
      .execute() as Promise<Array<{ queue: unknown, failed: unknown }>>,
  ])

  const failed = new Map<string, number>()
  for (const row of failedRows)
    failed.set(queueName(row.queue), (failed.get(queueName(row.queue)) ?? 0) + Number(row.failed))

  // A NULL, an empty and a 'default' queue are all the default queue.
  const queues = new Map<string, { total: number, active: number, firstId: number }>()
  for (const row of jobRows) {
    const name = queueName(row.queue)
    const current = queues.get(name) ?? { total: 0, active: 0, firstId: Number.POSITIVE_INFINITY }
    queues.set(name, {
      total: current.total + Number(row.total),
      active: current.active + Number(row.active),
      firstId: Math.min(current.firstId, Number(row.first_id)),
    })
  }

  return [...queues.entries()]
    .sort(([, a], [, b]) => a.firstId - b.firstId)
    .map(([name, counts]) => ({
      name,
      pending: counts.total - counts.active,
      active: counts.active,
      failed: failed.get(name) ?? 0,
      total: counts.total,
    }))
}
