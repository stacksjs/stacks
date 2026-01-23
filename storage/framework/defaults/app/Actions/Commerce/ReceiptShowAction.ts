import type { ReceiptRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { receipts } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Receipt Show',
  description: 'Receipt Show ORM Action',
  method: 'GET',
  async handle(request: ReceiptRequestType) {
    const id = request.getParam('id')

    const model = await receipts.fetchById(id)

    return response.json(model)
  },
})
