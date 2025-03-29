import type { PrintLogRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { PrintLog } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'PrintLog Destroy',
  description: 'PrintLog Destroy ORM Action',
  method: 'DELETE',
  async handle(request: PrintLogRequestType) {
    const id = request.getParam('id')

    const model = await PrintLog.findOrFail(Number(id))

    model.delete()

    return response.json({ message: 'Model deleted!' })
  },
})
