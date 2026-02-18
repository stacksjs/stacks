import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'DeliveryRoute Destroy',
  description: 'DeliveryRoute Destroy ORM Action',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const id = request.getParam('id')

    await shippings.routes.destroy(id)

    return response.json({ message: 'DeliveryRoute deleted successfully' })
  },
})
