import type { ActivityRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'Activity Show',
  description: 'Activity Show ORM Action',
  method: 'GET',
  async handle(request: ActivityRequestType) {
    const id = request.getParam('id')

    return await Activity.findOrFail(Number(id))
  },
})
