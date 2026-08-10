import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { emailSDK } from '@stacksjs/email'
import { dashboardMailbox, inboxActionError } from './inbox-request'

export interface InboxItem {
  messageId: string
  from: string
  fromName?: string
  to: string
  subject: string
  date: string
  read: boolean
  preview?: string
  hasAttachments?: boolean
  path: string
}

export default new Action({
  name: 'InboxIndexAction',
  description: 'Returns real inbound emails for a mailbox from S3.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    try {
      const mailbox = dashboardMailbox(request)
      const emails = await emailSDK.getInbox(mailbox, { limit: 1000 })

      return {
        mailbox,
        total: emails.length,
        emails,
      }
    }
    catch (err) {
      return inboxActionError(err, 'Inbox messages could not be loaded.')
    }
  },
})
