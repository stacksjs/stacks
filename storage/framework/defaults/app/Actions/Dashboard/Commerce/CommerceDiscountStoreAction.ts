import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { asFieldErrors, saveDiscount } from './commerce-discount-write'
import { normalizeCommerceCurrency } from './commerce-product-records'

/** `POST /api/dashboard/commerce/discounts` - create a discount, checked by the engine first. */
export default new Action({
  name: 'CommerceDiscountStoreAction',
  description: 'Creates a Discount from the dashboard.',
  method: 'POST',
  apiResponse: true,

  async handle(request: RequestInstance) {
    try {
      const result = await saveDiscount(null, request.all() as Record<string, unknown>, normalizeCommerceCurrency(config.commerce?.currency))
      if (!result.ok)
        return response.json({ message: result.message, errors: asFieldErrors(result.errors) }, result.status)
      return response.json(result.record, 201)
    }
    catch (error) {
      return dashboardOperationalError(error, 'The discount could not be saved.', 'CommerceDiscountStoreAction')
    }
  },
})

