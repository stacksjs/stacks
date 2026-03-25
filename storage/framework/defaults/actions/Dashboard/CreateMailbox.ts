import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'CreateMailbox',
  description: 'Creates a new mailbox.',
  method: 'POST',
  apiResponse: true,

  async handle() {
    // TODO: replace with model query when Mailbox model is available
  },
})
