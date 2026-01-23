import type { ShippingRateRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingRate Destroy',
  description: 'ShippingRate Destroy ORM Action',
  method: 'DELETE',
  async handle(request: ShippingRateRequestType) {
    const id = request.getParam('id')

    await shippings.rates.destroy(id)

    return response.json({ message: 'ShippingRate deleted successfully' })
  },
})
