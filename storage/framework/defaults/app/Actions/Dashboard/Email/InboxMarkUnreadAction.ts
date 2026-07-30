import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { emailSDK } from '@stacksjs/email'
import { response } from '@stacksjs/router'
import { defaultMailbox } from './mail-preference'

export default new Action({
  name: 'InboxMarkUnreadAction',
  description: 'Marks a single inbound email as unread.',
  method: 'POST',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const mailbox = String(request.get('mailbox') || defaultMailbox())
    const messageId = String(request.get('messageId') || '')

    if (!messageId)
      return response.json({ message: 'messageId is required.' }, 422)

    const success = await emailSDK.markAsUnread(mailbox, messageId)
    if (!success)
      return response.json({ message: 'Email not found or its read state could not be updated.' }, 404)

    return response.json({ success: true, mailbox, messageId })
  },
})
