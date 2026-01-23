import { Action } from '@stacksjs/actions'
import { errors } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Error Ignore',
  description: 'Ignore all errors in a group',
  method: 'PATCH',
  async handle(request: any) {
    const { type, message } = request.body || {}

    if (!type || !message) {
      return response.json({ error: 'Both type and message are required' }, 400)
    }

    const success = await errors.ignoreGroup(type, message)

    if (!success) {
      return response.json({ error: 'Failed to ignore errors' }, 500)
    }

    return response.json({ data: { success: true, message: 'Errors ignored successfully' } })
  },
})
