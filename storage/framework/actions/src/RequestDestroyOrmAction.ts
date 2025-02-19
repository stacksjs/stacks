import type { RequestRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'Request Destroy',
  description: 'Request Destroy ORM Action',
  method: 'DELETE',
  async handle(request: RequestRequestType) {
    const id = request.getParam('id')

    const model = await Request.findOrFail(Number(id))

    model.delete()

    return 'Model deleted!'
  },
})
