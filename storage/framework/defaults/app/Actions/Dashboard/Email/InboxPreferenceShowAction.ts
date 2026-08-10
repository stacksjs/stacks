import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { MailPreference } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardMailbox, inboxActionError } from './inbox-request'
import { serializeMailPreference } from './mail-preference'

export default new Action({
  name: 'InboxPreferenceShowAction',
  description: 'Returns the persisted settings for the configured dashboard mailbox.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    try {
      const mailbox = dashboardMailbox(request)
      const record = await MailPreference.where('mailbox', '=', mailbox).first()
      return response.json({ preference: serializeMailPreference(record, mailbox) })
    }
    catch (error) {
      return inboxActionError(error, 'Mail settings could not be loaded.')
    }
  },
})
