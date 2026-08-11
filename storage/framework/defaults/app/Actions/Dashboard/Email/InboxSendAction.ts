import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { notify } from '@stacksjs/notifications'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'
import { dashboardOperationalError } from '../dashboard-response'

export default new Action({
  name: 'InboxSendAction',
  description: 'Sends a composed dashboard email and records its delivery attempt.',
  method: 'POST',
  apiResponse: true,
  validations: {
    to: {
      rule: schema.string().email().max(320).required(),
      message: 'Enter a valid recipient email address.',
    },
    subject: {
      rule: schema.string().max(255).required(),
      message: 'A subject is required and may not exceed 255 characters.',
    },
    body: {
      rule: schema.string().max(100_000).required(),
      message: 'A message body is required.',
    },
  },

  async handle(request: RequestInstance) {
    const to = String(request.get('to') || '').trim()
    const subject = String(request.get('subject') || '').trim()
    const body = String(request.get('body') || '').trim()

    let result
    try {
      [result] = await notify(
        { email: to },
        { subject, body, data: { source: 'dashboard-inbox' } },
        ['email'],
        { ignorePreferences: true },
      )
    }
    catch (error) {
      return dashboardOperationalError(error, 'The email could not be sent.', 'InboxSendAction.provider', 502)
    }

    if (!result?.success)
      return dashboardOperationalError(result?.error, 'The email could not be sent.', 'InboxSendAction.result', 502)

    return response.json({ success: true })
  },
})
