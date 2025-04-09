import type { DeliveryRouteRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'DeliveryRoute Destroy',
  description: 'DeliveryRoute Destroy ORM Action',
  method: 'DELETE',
  async handle(request: DeliveryRouteRequestType) {
    const id = request.getParam('id')

    await shippings.routes.destroy(id)

    return response.json({ message: 'DeliveryRoute deleted successfully' })
  },
})
