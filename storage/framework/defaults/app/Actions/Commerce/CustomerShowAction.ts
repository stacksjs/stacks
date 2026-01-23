import type { CustomerRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { customers } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Customer Show',
  description: 'Customer Show ORM Action',
  method: 'GET',
  async handle(request: CustomerRequestType) {
    const id = request.getParam('id')

    const model = await customers.fetchById(id)

    return response.json(model)
  },
})
