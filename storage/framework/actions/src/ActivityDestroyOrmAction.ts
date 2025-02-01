import type { ActivityRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'Activity Destroy',
  description: 'Activity Destroy ORM Action',
  method: 'DELETE',
  async handle(request: ActivityRequestType) {
    const id = request.getParam('id')

    const model = await Activity.findOrFail(Number(id))

    model.delete()

    return 'Model deleted!'
  },
})
