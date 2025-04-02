import type { ReceiptRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { receipts } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Receipt Update',
  description: 'Receipt Update ORM Action',
  method: 'PATCH',
  async handle(request: ReceiptRequestType) {
    await request.validate()

    const id = request.getParam('id')

    const result = await receipts.update(Number(id), request)

    return response.json(result)
  },
})
