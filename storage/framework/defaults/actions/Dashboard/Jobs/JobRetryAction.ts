import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'JobRetryAction',
  description: 'Retries a failed job.',
  method: 'POST',
  async handle() {
    // TODO: replace with Job.retry() when available
    return { success: true, message: 'Job queued for retry' }
  },
})
