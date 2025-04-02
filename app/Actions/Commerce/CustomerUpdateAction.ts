import type { CustomerRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { customers } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Customer Update',
  description: 'Customer Update ORM Action',
  method: 'PATCH',
  async handle(request: CustomerRequestType) {
    const id = request.getParam('id')

    const result = await customers.update(Number(id), request)

    return response.json(result)
  },
})
