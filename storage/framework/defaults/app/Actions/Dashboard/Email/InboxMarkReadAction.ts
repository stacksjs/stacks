import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { emailSDK } from '@stacksjs/email'
import { response } from '@stacksjs/router'
import { dashboardMailbox, inboxActionError } from './inbox-request'

export default new Action({
  name: 'InboxMarkReadAction',
  description: 'Marks a single inbound email as read.',
  method: 'POST',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const messageId = String(request.get('messageId') || '')

    if (!messageId)
      return response.json({ message: 'messageId is required.' }, 422)

    try {
      const mailbox = dashboardMailbox(request)
      const success = await emailSDK.markAsRead(mailbox, messageId)
      if (!success)
        return response.json({ message: 'Email not found or its read state could not be updated.' }, 404)

      return response.json({ success: true, mailbox, messageId })
    }
    catch (error) {
      return inboxActionError(error, 'The email read state could not be updated.')
    }
  },
})
