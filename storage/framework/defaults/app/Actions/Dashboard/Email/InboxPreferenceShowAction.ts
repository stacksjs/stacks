import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { MailPreference } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { defaultMailbox, serializeMailPreference } from './mail-preference'

export default new Action({
  name: 'InboxPreferenceShowAction',
  description: 'Returns the persisted settings for the configured dashboard mailbox.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const mailbox = String(request.get('mailbox') || defaultMailbox()).trim().toLowerCase()
    const record = await MailPreference.where('mailbox', '=', mailbox).first()
    return response.json({ preference: serializeMailPreference(record, mailbox) })
  },
})
