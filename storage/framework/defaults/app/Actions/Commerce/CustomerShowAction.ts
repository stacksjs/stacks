import { Action } from '@stacksjs/actions'

import { customers } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'Customer Show',
  description: 'Customer Show ORM Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Customer')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const model = await customers.fetchById(id)
    if (!model)
      return commerceNotFound('Customer', id)

    return response.json(model)
  },
})
