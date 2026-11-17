import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { deleteUpsellOffer } from './commerce-upsell-list'

/**
 * `DELETE /api/dashboard/commerce/upsells/{id}` - remove an offer nobody has
 * answered. One with responses is refused (409): switch it off instead.
 */
export default new Action({
  name: 'CommerceUpsellDestroyAction',
  description: 'Deletes an unanswered post-purchase offer from the dashboard.',
  method: 'DELETE',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))
    if (!Number.isSafeInteger(id) || id <= 0)
      return response.json({ message: 'The offer id must be a positive whole number.' }, 422)
    try {
      const result = await deleteUpsellOffer(id)
      if (!result.ok)
        return response.json({ message: result.message }, result.status)
      return response.json({ ok: true })
    }
    catch (error) {
      return dashboardOperationalError(error, 'The offer could not be deleted.', 'CommerceUpsellDestroyAction')
    }
  },
})
