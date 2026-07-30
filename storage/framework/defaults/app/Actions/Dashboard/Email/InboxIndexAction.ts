import { Action } from '@stacksjs/actions'
import { emailSDK } from '@stacksjs/email'
import { response } from '@stacksjs/router'
import { defaultMailbox } from './mail-preference'

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

  async handle(request: any) {
    try {
      const mailbox = request?.query?.mailbox || defaultMailbox()
      const emails = await emailSDK.getInbox(mailbox, { limit: 1000 })

      return {
        mailbox,
        total: emails.length,
        emails,
      }
    }
    catch (err) {
      return response.json({
        message: err instanceof Error ? err.message : 'Inbox messages could not be loaded.',
      }, 503)
    }
  },
})
