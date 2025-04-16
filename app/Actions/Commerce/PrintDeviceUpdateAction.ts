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

    const data = {
      name: request.get('name'),
      mac_address: request.get('mac_address'),
      location: request.get('location'),
      terminal: request.get('terminal'),
      status: request.get('status'),
    }

    const model = await devices.update(id, data)

    return response.json(model)
  },
})
