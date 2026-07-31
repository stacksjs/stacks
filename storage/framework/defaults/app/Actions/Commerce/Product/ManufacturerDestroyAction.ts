import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'Manufacturer Destroy',
  description: 'Deletes a manufacturer through the native commerce module.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Manufacturer')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await products.manufacturers.destroy(id)
    if (!deleted)
      return commerceNotFound('Manufacturer', id)

    return response.noContent()
  },
})
