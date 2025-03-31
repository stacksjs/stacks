import type { PrintDeviceRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { PrintDevice } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'PrintDevice Show',
  description: 'PrintDevice Show ORM Action',
  method: 'GET',
  async handle(request: PrintDeviceRequestType) {
    const id = request.getParam('id')

    const model = await PrintDevice.findOrFail(Number(id))

    return response.json(model)
  },
})
