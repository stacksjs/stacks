import type { DriverRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'Driver Destroy',
  description: 'Driver Destroy ORM Action',
  method: 'DELETE',
  async handle(request: DriverRequestType) {
    const id = request.getParam('id')

    const model = await Driver.findOrFail(Number(id))

    model.delete()

    return 'Model deleted!'
  },
})
