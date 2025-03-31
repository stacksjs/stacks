import type { ReceiptRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Receipt } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Receipt Update',
  description: 'Receipt Update ORM Action',
  method: 'PATCH',
  async handle(request: ReceiptRequestType) {
    await request.validate()

    const id = request.getParam('id')
    const model = await Receipt.findOrFail(Number(id))

    const result = model.update(request.all())

    return response.json(result)
  },
})
