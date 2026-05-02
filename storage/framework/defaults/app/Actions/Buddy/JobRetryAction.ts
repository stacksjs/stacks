import { Action } from '@stacksjs/actions'

/**
 * POST /api/buddy/jobs/:id/retry
 *
 * Move a failed job back into the active queue. The dashboard's
 * `jobs/history.stx` calls this when the user clicks "Retry" on a
 * failed-job row.
 */
export default new Action({
  name: 'Buddy Job Retry',
  description: 'Re-queue a failed job for processing.',

  async handle(request) {
    const id = String(request.get('id', '') ?? '')
    if (!id) return new Response(JSON.stringify({ error: 'missing id' }), { status: 400 })

    try {
      const { db } = await import('@stacksjs/database')
      const dbAny = db as any

      const failed = await dbAny.selectFrom('failed_jobs').selectAll().where('id', '=', id).executeTakeFirst()
      if (!failed) {
        return new Response(JSON.stringify({ error: 'failed job not found' }), { status: 404 })
      }

      // Move the row back to the live queue, resetting attempts so the
      // worker doesn't immediately re-fail it.
      const now = Math.floor(Date.now() / 1000)
      await dbAny.insertInto('jobs').values({
        queue: failed.queue,
        payload: failed.payload,
        attempts: 0,
        reserved_at: null,
        available_at: now,
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      }).execute()
      await dbAny.deleteFrom('failed_jobs').where('id', '=', id).execute()

      return { ok: true, retriedAt: now }
    }
    catch (err) {
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }
  },
})
