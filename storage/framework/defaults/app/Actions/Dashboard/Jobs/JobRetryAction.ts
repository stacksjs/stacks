import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'JobRetryAction',
  description: 'Retries a failed job.',
  method: 'POST',
  async handle() {
    return { success: true, message: 'Job queued for retry' }
  },
})
