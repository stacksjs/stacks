import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'DigitalDelivery Destroy',
  description: 'DigitalDelivery Destroy ORM Action',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Digital delivery')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await shippings.digital.destroy(id)
    if (!deleted)
      return commerceNotFound('Digital delivery', id)

    return response.json({ message: 'DigitalDelivery deleted successfully' })
  },
})
