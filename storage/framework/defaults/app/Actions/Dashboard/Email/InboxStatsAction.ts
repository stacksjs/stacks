import { Action } from '@stacksjs/actions'
import { emailSDK } from '@stacksjs/email'
import { response } from '@stacksjs/router'
import { defaultMailbox } from './mail-preference'

export default new Action({
  name: 'InboxStatsAction',
  description: 'Returns aggregate inbox statistics (total/unread/read) for a mailbox.',
  method: 'GET',
  apiResponse: true,

  async handle(request: any) {
    try {
      const mailbox = request?.query?.mailbox || defaultMailbox()
      const stats = await emailSDK.getInboxStats(mailbox)

      return {
        mailbox,
        ...stats,
      }
    }
    catch (err) {
      return response.json({
        message: err instanceof Error ? err.message : 'Inbox statistics could not be loaded.',
      }, 503)
    }
  },
})
