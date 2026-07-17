import { Action } from '@stacksjs/actions'
import { emailSDK } from '@stacksjs/email'
import { config } from '@stacksjs/config'

function defaultMailbox(): string {
  const domain = (config as any)?.email?.domain || 'stacksjs.com'
  return `chris@${domain}`
}

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
      return {
        mailbox: request?.query?.mailbox || defaultMailbox(),
        total: 0,
        unread: 0,
        read: 0,
        error: err instanceof Error ? err.message : 'unknown error',
      }
    }
  },
})
