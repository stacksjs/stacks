import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { asFieldErrors } from './commerce-discount-write'
import { saveUpsellOffer } from './commerce-upsell-list'

/** `POST /api/dashboard/commerce/upsells` - create a post-purchase offer. */
export default new Action({
  name: 'CommerceUpsellStoreAction',
  description: 'Creates a post-purchase offer from the dashboard.',
  method: 'POST',
  apiResponse: true,

  async handle(request: RequestInstance) {
    try {
      const result = await saveUpsellOffer(null, request.all() as Record<string, unknown>)
      if (!result.ok)
        return response.json({ message: result.message, errors: asFieldErrors(result.errors) }, result.status)
      return response.json(result.record, 201)
    }
    catch (error) {
      return dashboardOperationalError(error, 'The offer could not be saved.', 'CommerceUpsellStoreAction')
    }
  },
})
