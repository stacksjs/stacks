import { Action } from '@stacksjs/actions'

import { coupons } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Coupon Update',
  description: 'Coupon Update ORM Action',
  method: 'PATCH',
  model: Coupon,
  async handle(request: RequestInstance) {
    await request.validate()

    const id = request.getParam('id')

    const data = toSnakeCaseKeys(request.all())

    const model = await coupons.update(id, data)

    return response.json(model)
  },
})
