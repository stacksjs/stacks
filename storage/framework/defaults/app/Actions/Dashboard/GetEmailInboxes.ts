import { Action } from '@stacksjs/actions'
// import { Email } from '@stacksjs/orm'

export default new Action({
  name: 'GetEmailInboxes',
  description: 'Gets the email inboxes.',
  apiResponse: true,

  async handle() {
    // return Email.inboxes()
  },
})
