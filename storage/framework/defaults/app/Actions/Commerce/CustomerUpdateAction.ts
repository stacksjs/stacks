import { Action } from '@stacksjs/actions'

import { customers } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Customer Update',
  description: 'Customer Update ORM Action',
  method: 'PATCH',
  model: Customer,
  async handle(request: RequestInstance) {
    await request.validate()

    const id = request.getParam('id')

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

    return response.json(result)
  },
})
