import { Action } from '@stacksjs/actions'

/**
 * POST /api/buddy/jobs/:id/cancel
 *
 * Mark an in-flight job as cancelled. Workers that call
 * `isJobCancelled(id)` between iterations will see the flag and exit
 * cleanly. The framework can't preempt a running handler, so the
 * worker is responsible for honoring the cancellation between units
 * of work.
 */
export default new Action({
  name: 'Buddy Job Cancel',
  description: 'Signal a running job to stop on its next checkpoint.',

  async handle(request) {
    const id = String(request.get('id', '') ?? '')
    if (!id) return new Response(JSON.stringify({ error: 'missing id' }), { status: 400 })

    try {
      const { cancelJob } = await import('@stacksjs/queue')
      await cancelJob(id)
      return { ok: true, id }
    }
    catch (err) {
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }
  },
})
