import type { CustomerRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'Customer Destroy',
  description: 'Customer Destroy ORM Action',
  method: 'DELETE',
  async handle(request: CustomerRequestType) {
    const id = request.getParam('id')

    const model = await Customer.findOrFail(Number(id))

    model.delete()

    return 'Model deleted!'
  },
})
