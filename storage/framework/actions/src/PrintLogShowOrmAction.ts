import type { PrintLogRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { PrintLog } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'PrintLog Show',
  description: 'PrintLog Show ORM Action',
  method: 'GET',
  async handle(request: PrintLogRequestType) {
    const id = request.getParam('id')

    const model = await PrintLog.findOrFail(Number(id))

    return response.json(model)
  },
})
