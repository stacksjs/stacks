import { Action } from '@stacksjs/actions'

import { coupons } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'Coupon Show',
  description: 'Coupon Show ORM Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Coupon')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const model = await coupons.fetchById(id)
    if (!model)
      return commerceNotFound('Coupon', id)

    return response.json(model)
  },
})
