import { Action } from '@stacksjs/actions'
import { errors } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Error Destroy',
  description: 'Delete all errors in a group',
  method: 'DELETE',
  async handle(request: any) {
    const type = decodeURIComponent(request.query.type || '')
    const message = decodeURIComponent(request.query.message || '')

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
