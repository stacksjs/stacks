import { Action } from '@stacksjs/actions'
import { emailSDK } from '@stacksjs/email'
import { response } from '@stacksjs/router'
import { defaultMailbox } from './mail-preference'
import { sanitizeInboxHtml } from './sanitize-inbox-html'

export default new Action({
  name: 'InboxShowAction',
  description: 'Returns the body and metadata of a single inbound email.',
  method: 'GET',
  apiResponse: true,

  async handle(request: any) {
    try {
      const mailbox = request?.query?.mailbox || defaultMailbox()
      const messageId = request?.params?.id

      if (!messageId)
        return response.json({ message: 'A message ID is required.' }, 422)

      const email = await emailSDK.getEmail(mailbox, messageId)
      if (!email)
        return response.json({ message: 'Email not found.' }, 404)

      return {
        mailbox,
        messageId,
        html: sanitizeInboxHtml(email.html ?? ''),
        text: email.text ?? '',
        metadata: email.metadata,
      }
    }
    catch (err) {
      return response.json({
        message: err instanceof Error ? err.message : 'Email content could not be loaded.',
      }, 503)
    }
  },
})
