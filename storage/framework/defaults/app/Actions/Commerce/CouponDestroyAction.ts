import { Action } from '@stacksjs/actions'

import { coupons } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'Coupon Destroy',
  description: 'Coupon Destroy ORM Action',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Coupon')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await coupons.deleteCoupon(id)
    if (!deleted)
      return commerceNotFound('Coupon', id)

    return response.noContent()
  },
})
