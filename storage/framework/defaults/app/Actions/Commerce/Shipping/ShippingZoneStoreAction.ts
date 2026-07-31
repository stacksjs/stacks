import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingZone Store',
  description: 'ShippingZone Store ORM Action',
  method: 'POST',
  model: ShippingZone,
  async handle(request: RequestInstance) {
    await request.validate()
    const data = await request.all()

    const model = await shippings.zones.store(data)

    return response.json(model)
  },
})
