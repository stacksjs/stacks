import type { PrintDeviceRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { devices } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'PrintDevice Store',
  description: 'PrintDevice Store ORM Action',
  method: 'POST',
  async handle(request: PrintDeviceRequestType) {
    await request.validate()

    const data = {
      name: request.get('name'),
      mac_address: request.get('mac_address'),
      location: request.get('location'),
      terminal: request.get('terminal'),
      status: request.get('status'),
      last_ping: request.get<number>('last_ping'),
      print_count: request.get<number>('print_count'),
    }

    const model = await devices.store(data)

    return response.json(model)
  },
})
