import { Action } from '@stacksjs/actions'
import { request, response } from '@stacksjs/router'
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
      return response.json({ message: 'Only failed jobs can be retried.' }, 409)
    }
    if (!Number.isFinite(id) || id <= 0) {
      return response.json({ message: 'Job id must identify a failed job.' }, 422)
    }

    try {
      await retryFailedJob(id)
      return { success: true, message: `Job ${id} re-queued` }
    }
    catch (e) {
      const message = (e as Error).message || 'Failed job could not be retried.'
      return response.json({ message }, message.includes('not found') ? 404 : 500)
    }
  },
})
