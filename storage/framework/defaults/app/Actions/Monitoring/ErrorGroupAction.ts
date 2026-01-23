import { Action } from '@stacksjs/actions'
import { errors } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Error Group',
  description: 'Fetch all errors in a specific group (by type and message)',
  method: 'GET',
  async handle(request: any) {
    const type = decodeURIComponent(request.query.type || '')
    const message = decodeURIComponent(request.query.message || '')

    if (!type || !message) {
      return response.json({ error: 'Both type and message are required' }, 400)
    }

    const results = await errors.fetchByGroup(type, message)

    return response.json({ data: results })
  },
})
