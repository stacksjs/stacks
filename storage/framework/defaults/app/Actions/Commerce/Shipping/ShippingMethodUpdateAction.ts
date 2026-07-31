import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'ShippingMethod Update',
  description: 'ShippingMethod Update ORM Action',
  method: 'PATCH',
  model: ShippingMethod,
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Shipping method')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    await request.validate()
    const data = await request.all()
    const model = await shippings.methods.update(id, data)
    if (!model)
      return commerceNotFound('Shipping method', id)

    return response.json(model)
  },
})
