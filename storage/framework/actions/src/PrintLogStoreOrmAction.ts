import type { PrintLogRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { PrintLog } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'PrintLog Store',
  description: 'PrintLog Store ORM Action',
  method: 'POST',
  async handle(request: PrintLogRequestType) {
    await request.validate()
    const model = await PrintLog.create(request.all())

    return response.json(model)
  },
})
