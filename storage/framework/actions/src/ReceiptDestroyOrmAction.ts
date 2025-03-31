import type { ReceiptRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Receipt } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Receipt Destroy',
  description: 'Receipt Destroy ORM Action',
  method: 'DELETE',
  async handle(request: ReceiptRequestType) {
    const id = request.getParam('id')

    const model = await Receipt.findOrFail(Number(id))

    model.delete()

    return response.json({ message: 'Model deleted!' })
  },
})
