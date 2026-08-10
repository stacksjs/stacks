import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { emailSDK } from '@stacksjs/email'
import { response } from '@stacksjs/router'
import { dashboardMailbox, inboxActionError } from './inbox-request'
import { sanitizeInboxHtml } from './sanitize-inbox-html'

export default new Action({
  name: 'InboxShowAction',
  description: 'Returns the body and metadata of a single inbound email.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    try {
      const mailbox = dashboardMailbox(request)
      const messageId = String(request.getParam('id') || '')

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
        attachments: email.attachments,
      }
    }
    catch (err) {
      return inboxActionError(err, 'Email content could not be loaded.')
    }
  },
})
