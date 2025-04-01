import type { ReceiptRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Receipt } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Receipt Store',
  description: 'Receipt Store ORM Action',
  method: 'POST',
  async handle(request: ReceiptRequestType) {
    await request.validate()
    const model = await Receipt.create(request.all())

    return response.json(model)
  },
})
