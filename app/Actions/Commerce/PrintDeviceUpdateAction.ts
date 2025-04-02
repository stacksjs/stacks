import type { PrintDeviceRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { devices } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'PrintDevice Update',
  description: 'PrintDevice Update ORM Action',
  method: 'PATCH',
  async handle(request: PrintDeviceRequestType) {
    const id = request.getParam<number>('id')

    const model = await devices.update(id, request)

    return response.json(model)
  },
})
