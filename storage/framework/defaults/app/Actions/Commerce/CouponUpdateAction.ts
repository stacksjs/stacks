import { Action } from '@stacksjs/actions'

import { coupons } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'Coupon Update',
  description: 'Coupon Update ORM Action',
  method: 'PATCH',
  model: Coupon,
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Coupon')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    await request.validate()
    const data = toSnakeCaseKeys(request.all())

    const model = await coupons.update(id, data)
    if (!model)
      return commerceNotFound('Coupon', id)

    return response.json(model)
  },
})
