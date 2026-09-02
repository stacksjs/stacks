import { Action } from '@stacksjs/actions'
import { errors } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Error Group',
  description: 'Fetch all errors in a specific group (by type and message)',
  method: 'GET',
  async handle(request: RequestInstance) {
    const type = request.string('type')
    const message = request.string('message')

    if (!type || !message) {
      return response.json({ error: 'Both type and message are required' }, 400)
    }

    const results = await errors.fetchByGroup(type, message)

    return response.json({ data: results })
  },
})
