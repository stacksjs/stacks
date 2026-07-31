import { Action } from '@stacksjs/actions'
import { customers } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'Customer Destroy',
  description: 'Customer Destroy ORM Action',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Customer')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await customers.destroy(id)
    if (!deleted)
      return commerceNotFound('Customer', id)

    return response.noContent()
  },
})
