import { Action } from '@stacksjs/actions'
import { errors } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Error Destroy',
  description: 'Delete all errors in a group',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const type = decodeURIComponent(request.string('type'))
    const message = decodeURIComponent(request.string('message'))

    if (!type || !message) {
      return response.json({ error: 'Both type and message are required' }, 400)
    }

    const success = await errors.destroyGroup(type, message)

    if (!success) {
      return response.json({ error: 'Failed to delete errors' }, 500)
    }

    return response.json({ data: { success: true, message: 'Errors deleted successfully' } })
  },
})
