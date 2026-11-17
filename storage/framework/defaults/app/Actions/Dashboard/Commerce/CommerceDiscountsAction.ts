import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parseDiscountListQuery, readDiscountPage } from './commerce-discount-list'
import { normalizeCommerceCurrency } from './commerce-product-records'

/**
 * `GET /api/dashboard/commerce/discounts` - one page of discounts, searched,
 * filtered by method, type and state, sorted and counted by the database, with
 * the summary of every discount (commerce-discount-list.ts). The store
 * currency comes with it: fixed amounts and minimums are minor units of it.
 */
export default new Action({
  name: 'CommerceDiscountsAction',
  description: 'Returns one page of Discount records for dashboard management.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const query = parseDiscountListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    const currency = normalizeCommerceCurrency(config.commerce?.currency)
    try {
      const discounts = await readDiscountPage(query, currency)
      return {
        records: discounts.records,
        total: discounts.total,
        page: discounts.page,
        perPage: query.perPage,
        summary: discounts.summary,
        currency,
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Discount records could not be read.', 'CommerceDiscountsAction')
    }
  },
})
