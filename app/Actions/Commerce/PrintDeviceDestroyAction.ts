import type { PrintDeviceRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { devices } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'PrintDevice Destroy',
  description: 'PrintDevice Destroy ORM Action',
  method: 'DELETE',
  async handle(request: PrintDeviceRequestType) {
    const id = request.getParam('id')

    await devices.destroy(id)

    return response.json({ message: 'PrintDevice deleted successfully' })
  },
})
