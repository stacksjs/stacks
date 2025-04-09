import type { ShippingRateRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingRate Show',
  description: 'ShippingRate Show ORM Action',
  method: 'GET',
  async handle(request: ShippingRateRequestType) {
    const id = request.getParam('id')

    const model = await shippings.rates.fetchById(id)

    return response.json(model)
  },
})
