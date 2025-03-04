import type { TransactionRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Transaction Store',
  description: 'Transaction Store ORM Action',
  method: 'POST',
  async handle(request: TransactionRequestType) {
    await request.validate()
    const model = await Transaction.create(request.all())

    return response.json(model)
  },
})
