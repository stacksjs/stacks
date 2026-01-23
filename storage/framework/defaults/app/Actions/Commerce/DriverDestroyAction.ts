import type { DriverRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Driver Destroy',
  description: 'Driver Destroy ORM Action',
  method: 'DELETE',
  async handle(request: DriverRequestType) {
    const id = request.getParam('id')

    await shippings.drivers.destroy(id)

    return response.json({ message: 'Driver deleted successfully' })
  },
})
