import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'QueueRetryFailedAction',
  description: 'Retries all failed jobs in the queue.',
  method: 'POST',
  async handle() {
    // TODO: replace with model query when available
    return { success: true, message: 'Failed jobs queued for retry', count: 0 }
  },
})
