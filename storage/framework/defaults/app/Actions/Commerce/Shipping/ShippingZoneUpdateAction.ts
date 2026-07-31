import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'ShippingZone Update',
  description: 'ShippingZone Update ORM Action',
  method: 'PATCH',
  model: ShippingZone,
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Shipping zone')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    await request.validate()
    const data = await request.all()
    const model = await shippings.zones.update(id, data)
    if (!model)
      return commerceNotFound('Shipping zone', id)

    return response.json(model)
  },
})
