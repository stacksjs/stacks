import type { PrintDeviceRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { devices } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'PrintDevice Update',
  description: 'PrintDevice Update ORM Action',
  method: 'PATCH',
  async handle(request: PrintDeviceRequestType) {
    await request.validate()

    const id = request.getParam('id')

    const model = await devices.update(Number(id), request)

    return response.json(model)
  },
})
