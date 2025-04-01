import type { TransactionRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Transaction Show',
  description: 'Transaction Show ORM Action',
  method: 'GET',
  async handle(request: TransactionRequestType) {
    const id = request.getParam('id')

    const model = await Transaction.findOrFail(Number(id))

    return response.json(model)
  },
})
