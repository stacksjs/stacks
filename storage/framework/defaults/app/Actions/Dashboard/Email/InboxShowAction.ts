import { Action } from '@stacksjs/actions'
import { emailSDK } from '@stacksjs/email'
import { config } from '@stacksjs/config'

function defaultMailbox(): string {
  const domain = (config as any)?.email?.domain || 'stacksjs.com'
  return `chris@${domain}`
}

export default new Action({
  name: 'InboxShowAction',
  description: 'Returns the body and metadata of a single inbound email.',
  method: 'GET',
  apiResponse: true,

  async handle(request: any) {
    try {
      const mailbox = request?.query?.mailbox || defaultMailbox()
      const messageId = request?.params?.id

      if (!messageId) {
        return { error: 'messageId is required' }
      }

      const email = await emailSDK.getEmail(mailbox, messageId)
      if (!email) {
        return { error: 'Email not found' }
      }

      return {
        mailbox,
        messageId,
        html: email.html ?? '',
        text: email.text ?? '',
        metadata: email.metadata,
      }
    }
    catch (err) {
      return {
        error: err instanceof Error ? err.message : 'unknown error',
      }
    }
  },
})
