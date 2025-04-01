import type { ReceiptRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Receipt } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Receipt Show',
  description: 'Receipt Show ORM Action',
  method: 'GET',
  async handle(request: ReceiptRequestType) {
    const id = request.getParam('id')

    const model = await Receipt.findOrFail(Number(id))

    return response.json(model)
  },
})
