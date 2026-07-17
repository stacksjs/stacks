import { Action } from '@stacksjs/actions'
import { emailSDK } from '@stacksjs/email'
import { config } from '@stacksjs/config'

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

function defaultMailbox(): string {
  const domain = (config as any)?.email?.domain || 'stacksjs.com'
  return `chris@${domain}`
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
      return {
        mailbox: request?.query?.mailbox || defaultMailbox(),
        total: 0,
        emails: [],
        error: err instanceof Error ? err.message : 'unknown error',
      }
    }
  },
})
