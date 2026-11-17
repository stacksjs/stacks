import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { asFieldErrors, saveDiscount } from './commerce-discount-write'
import { normalizeCommerceCurrency } from './commerce-product-records'

/** `PATCH /api/dashboard/commerce/discounts/{id}` - change a discount, checked by the engine first. */
export default new Action({
  name: 'CommerceDiscountUpdateAction',
  description: 'Updates a Discount from the dashboard.',
  method: 'PATCH',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))
    if (!Number.isSafeInteger(id) || id <= 0)
      return response.json({ message: 'The discount id must be a positive whole number.' }, 422)
    try {
      const result = await saveDiscount(id, request.all() as Record<string, unknown>, normalizeCommerceCurrency(config.commerce?.currency))
      if (!result.ok)
        return response.json({ message: result.message, errors: asFieldErrors(result.errors) }, result.status)
      return response.json(result.record)
    }
    catch (error) {
      return dashboardOperationalError(error, 'The discount could not be saved.', 'CommerceDiscountUpdateAction')
    }
  },
})
