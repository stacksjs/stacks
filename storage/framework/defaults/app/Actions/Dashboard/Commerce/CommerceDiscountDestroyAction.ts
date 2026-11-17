import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { deleteDiscount } from './commerce-discount-write'

/** `DELETE /api/dashboard/commerce/discounts/{id}` - remove a discount. Placed orders keep their totals. */
export default new Action({
  name: 'CommerceDiscountDestroyAction',
  description: 'Deletes a Discount from the dashboard.',
  method: 'DELETE',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))
    if (!Number.isSafeInteger(id) || id <= 0)
      return response.json({ message: 'The discount id must be a positive whole number.' }, 422)
    try {
      if (!await deleteDiscount(id))
        return response.json({ message: `Discount ${id} does not exist.` }, 404)
      return response.json({ ok: true })
    }
    catch (error) {
      return dashboardOperationalError(error, 'The discount could not be deleted.', 'CommerceDiscountDestroyAction')
    }
  },
})
