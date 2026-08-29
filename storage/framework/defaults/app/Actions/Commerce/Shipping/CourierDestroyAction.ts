import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'Courier Destroy',
  description: 'Courier Destroy ORM Action',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Courier')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await shippings.couriers.destroy(id)
    if (!deleted)
      return commerceNotFound('Courier', id)

    return response.json({ message: 'Courier deleted successfully' })
  },
})
