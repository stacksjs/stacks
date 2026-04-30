import { Action } from '@stacksjs/actions'
import { executeFailedJobs } from '@stacksjs/queue'
import { FailedJob } from '@stacksjs/orm'

export default new Action({
  name: 'QueueRetryFailedAction',
  description: 'Re-queues every failed job recorded in the failed_jobs table.',
  method: 'POST',
  async handle() {
    try {
      const before = await FailedJob.count()
      await executeFailedJobs()
      const after = await FailedJob.count()
      const requeued = Math.max(0, before - after)

      return { success: true, message: `Re-queued ${requeued} failed job${requeued === 1 ? '' : 's'}`, count: requeued }
    }
    catch (e) {
      return { success: false, message: (e as Error).message || 'Failed to retry failed jobs', count: 0 }
    }
  },
})
