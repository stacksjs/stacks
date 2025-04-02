import type { ReceiptRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { receipts } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Receipt Store',
  description: 'Receipt Store ORM Action',
  method: 'POST',
  async handle(request: ReceiptRequestType) {
    const model = await receipts.store(request)

    return response.json(model)
  },
})
