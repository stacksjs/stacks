import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { asFieldErrors } from './commerce-discount-write'
import { saveUpsellOffer } from './commerce-upsell-list'

/** `PATCH /api/dashboard/commerce/upsells/{id}` - change a post-purchase offer. */
export default new Action({
  name: 'CommerceUpsellUpdateAction',
  description: 'Updates a post-purchase offer from the dashboard.',
  method: 'PATCH',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))
    if (!Number.isSafeInteger(id) || id <= 0)
      return response.json({ message: 'The offer id must be a positive whole number.' }, 422)
    try {
      const result = await saveUpsellOffer(id, request.all() as Record<string, unknown>)
      if (!result.ok)
        return response.json({ message: result.message, errors: asFieldErrors(result.errors) }, result.status)
      return response.json(result.record)
    }
    catch (error) {
      return dashboardOperationalError(error, 'The offer could not be saved.', 'CommerceUpsellUpdateAction')
    }
  },
})
