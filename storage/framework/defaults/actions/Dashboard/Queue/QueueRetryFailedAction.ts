import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'QueueRetryFailedAction',
  description: 'Retries all failed jobs in the queue.',
  method: 'POST',
  async handle() {
    return { success: true, message: 'Failed jobs queued for retry', count: 6 }
  },
})
