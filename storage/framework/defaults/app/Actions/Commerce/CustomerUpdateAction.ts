import { Action } from '@stacksjs/actions'

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
    const data = toSnakeCaseKeys({
      name: request.get('name'),
      email: request.get('email'),
      phone: request.get('phone'),
      totalSpent: request.get('totalSpent'),
      status: request.get('status'),
      avatar: request.get('avatar'),
      ...(request.get('lastOrder') && { lastOrder: request.get('lastOrder') }),
    })

    const result = await customers.update(id, data)
    if (!result)
      return commerceNotFound('Customer', id)

    return response.json(result)
  },
})
