import type { ShippingRateRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingRate Store',
  description: 'ShippingRate Store ORM Action',
  method: 'POST',
  async handle(request: ShippingRateRequestType) {
    const model = await shippings.rates.store(request)

    return response.json(model)
  },
})
