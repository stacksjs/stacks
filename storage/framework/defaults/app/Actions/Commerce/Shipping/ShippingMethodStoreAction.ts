import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingMethod Store',
  description: 'ShippingMethod Store ORM Action',
  method: 'POST',
  model: ShippingMethod,
  async handle(request: RequestInstance) {
    await request.validate()
    const data = await request.all()

    const model = await shippings.methods.store(data)

    return response.json(model)
  },
})
