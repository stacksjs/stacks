import type { ReceiptRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { receipts } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Receipt Update',
  description: 'Receipt Update ORM Action',
  method: 'PATCH',
  async handle(request: ReceiptRequestType) {
    const id = request.getParam<number>('id')

    const result = await receipts.update(id, request)

    return response.json(result)
  },
})
