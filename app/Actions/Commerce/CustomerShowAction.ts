import type { CustomerRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

import { customers } from '@stacksjs/commerce'

export default new Action({
  name: 'Customer Show',
  description: 'Customer Show ORM Action',
  method: 'GET',
  async handle(request: CustomerRequestType) {
    const id = request.getParam('id')

    const model = await customers.fetchById(Number(id))

    return response.json(model)
  },
})
