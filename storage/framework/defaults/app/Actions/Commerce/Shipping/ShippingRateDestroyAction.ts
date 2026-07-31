import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'ShippingRate Destroy',
  description: 'ShippingRate Destroy ORM Action',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Shipping rate')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await shippings.rates.destroy(id)
    if (!deleted)
      return commerceNotFound('Shipping rate', id)

    return response.json({ message: 'ShippingRate deleted successfully' })
  },
})
