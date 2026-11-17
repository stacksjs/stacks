import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { readUpsellDetail } from './commerce-upsell-list'

/** `GET /api/dashboard/commerce/upsells/{id}` - one offer, its funnel and its latest responses. */
export default new Action({
  name: 'CommerceUpsellDetailAction',
  description: 'Returns one post-purchase offer with its recent responses.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))
    if (!Number.isSafeInteger(id) || id <= 0)
      return response.json({ message: 'The offer id must be a positive whole number.' }, 422)
    try {
      const detail = await readUpsellDetail(id)
      if (!detail)
        return response.json({ message: `Offer ${id} does not exist.` }, 404)
      return detail
    }
    catch (error) {
      return dashboardOperationalError(error, 'The offer could not be read.', 'CommerceUpsellDetailAction')
    }
  },
})
