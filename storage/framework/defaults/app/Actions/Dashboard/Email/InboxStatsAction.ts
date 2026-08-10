import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { emailSDK } from '@stacksjs/email'
import { dashboardMailbox, inboxActionError } from './inbox-request'

export default new Action({
  name: 'InboxStatsAction',
  description: 'Returns aggregate inbox statistics (total/unread/read) for a mailbox.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    try {
      const mailbox = dashboardMailbox(request)
      const stats = await emailSDK.getInboxStats(mailbox)

      return {
        mailbox,
        ...stats,
      }
    }
    catch (err) {
      return inboxActionError(err, 'Inbox statistics could not be loaded.')
    }
  },
})
