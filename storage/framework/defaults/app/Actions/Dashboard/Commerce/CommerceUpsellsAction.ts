import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { normalizeCommerceCurrency } from './commerce-product-records'
import { parseUpsellListQuery, readUpsellPage } from './commerce-upsell-list'

/**
 * `GET /api/dashboard/commerce/upsells` - one page of post-purchase offers,
 * each with its funnel (shown, taken, turned down, revenue), and the totals
 * across every offer (commerce-upsell-list.ts).
 */
export default new Action({
  name: 'CommerceUpsellsAction',
  description: 'Returns one page of post-purchase offers with their conversion for dashboard management.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const query = parseUpsellListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const offers = await readUpsellPage(query)
      return {
        records: offers.records,
        total: offers.total,
        page: offers.page,
        perPage: query.perPage,
        summary: offers.summary,
        currency: normalizeCommerceCurrency(config.commerce?.currency),
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Post-purchase offers could not be read.', 'CommerceUpsellsAction')
    }
  },
})
