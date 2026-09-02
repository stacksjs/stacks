import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { readErrorsByGroup } from './error-provider'

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

    return response.json(await readErrorsByGroup(type, message))
  },
})
