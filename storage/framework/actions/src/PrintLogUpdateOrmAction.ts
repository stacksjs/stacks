import type { PrintLogRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { PrintLog } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'PrintLog Update',
  description: 'PrintLog Update ORM Action',
  method: 'PATCH',
  async handle(request: PrintLogRequestType) {
    await request.validate()

    const id = request.getParam('id')
    const model = await PrintLog.findOrFail(Number(id))

    const result = model.update(request.all())

    return response.json(result)
  },
})
