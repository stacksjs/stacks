import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'GetEmailInboxes',
  description: 'Gets the email inboxes.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    // TODO: replace with model query when Email model is available
    return { inboxes: [] }
  },
})
