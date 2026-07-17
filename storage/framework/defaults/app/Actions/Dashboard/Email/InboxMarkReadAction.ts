import { Action } from '@stacksjs/actions'
import { emailSDK } from '@stacksjs/email'
import { config } from '@stacksjs/config'

function defaultMailbox(): string {
  const domain = (config as any)?.email?.domain || 'stacksjs.com'
  return `chris@${domain}`
}

export default new Action({
  name: 'InboxMarkReadAction',
  description: 'Marks a single inbound email as read.',
  method: 'POST',
  apiResponse: true,

  async handle(request: any) {
    try {
      const body = request?.body || {}
      const mailbox = body.mailbox || defaultMailbox()
      const messageId = body.messageId

      if (!messageId) {
        return { ok: false, error: 'messageId is required' }
      }

      const ok = await emailSDK.markAsRead(mailbox, messageId)
      return { ok, mailbox, messageId }
    }
    catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'unknown error',
      }
    }
  },
})
