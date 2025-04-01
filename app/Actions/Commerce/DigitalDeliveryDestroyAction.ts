import type { DigitalDeliveryRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'DigitalDelivery Destroy',
  description: 'DigitalDelivery Destroy ORM Action',
  method: 'DELETE',
  async handle(request: DigitalDeliveryRequestType) {
    const id = request.getParam('id')

    const model = await DigitalDelivery.findOrFail(Number(id))

    model.delete()

    return 'Model deleted!'
  },
})
