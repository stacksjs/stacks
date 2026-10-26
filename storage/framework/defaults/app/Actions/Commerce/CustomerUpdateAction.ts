import { Action } from '@stacksjs/actions/runtime'

import { customers } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'Customer Update',
  description: 'Customer Update ORM Action',
  method: 'PATCH',
  model: Customer,
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Customer')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    await request.validate()
    // Only the fields the request sent: an absent one copied through
    // request.get() reached the query as undefined, which binds NULL and
    // erased the stored value or the column default (stacksjs/stacks#3010).
    const data = toSnakeCaseKeys({
      ...request.only(['name', 'email', 'phone', 'totalSpent', 'status', 'avatar']),
      ...(request.get('lastOrder') && { lastOrder: request.get('lastOrder') }),
    })

    const result = await customers.update(id, data)
    if (!result)
      return commerceNotFound('Customer', id)

    return response.json(result)
  },
})
