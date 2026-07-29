import { Action } from '@stacksjs/actions'
import { request } from '@stacksjs/router'
import { retryFailedJob } from '@stacksjs/queue'
import { parseJobReference } from './job-records'

export default new Action({
  name: 'JobRetryAction',
  description: 'Retries a single failed job by its failed_jobs id.',
  method: 'POST',
  async handle() {
    const reference = String((request as any).params?.id || '')
    const parsed = parseJobReference(reference)
    const id = Number(parsed.id)
    if (parsed.source === 'job') {
      return { success: false, message: 'Only failed jobs can be retried' }
    }
    if (!Number.isFinite(id) || id <= 0) {
      return { success: false, message: 'Invalid job id' }
    }

    try {
      await retryFailedJob(id)
      return { success: true, message: `Job ${id} re-queued` }
    }
    catch (e) {
      return { success: false, message: (e as Error).message || 'Retry failed' }
    }
  },
})
