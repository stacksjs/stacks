import type { ActivityRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'Activity Update',
  description: 'Activity Update ORM Action',
  method: 'PATCH',
  async handle(request: ActivityRequestType) {
    await request.validate()

    const id = request.getParam('id')
    const model = await Activity.findOrFail(Number(id))

    return model.update(request.all())
  },
})
