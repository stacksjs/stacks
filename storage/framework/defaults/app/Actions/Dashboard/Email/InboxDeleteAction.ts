import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { emailSDK } from '@stacksjs/email'
import { response } from '@stacksjs/router'

function defaultMailbox(): string {
  const domain = (config as any)?.email?.domain || 'stacksjs.com'
  return `chris@${domain}`
}

export default new Action({
  name: 'InboxDeleteAction',
  description: 'Permanently deletes a single inbound email and its stored message files.',
  method: 'DELETE',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const mailbox = String(request.get('mailbox') || defaultMailbox())
    const messageId = String(request.getParam('id') || '')

    if (!messageId)
      return response.json({ message: 'A message ID is required.' }, 422)

    const success = await emailSDK.delete(mailbox, messageId)
    if (!success)
      return response.json({ message: 'Email not found or it could not be deleted.' }, 404)

    return response.json({ success: true, mailbox, messageId })
  },
})
