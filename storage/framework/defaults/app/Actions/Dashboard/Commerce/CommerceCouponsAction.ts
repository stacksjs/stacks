import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parseCouponListQuery, readCouponPage } from './commerce-coupon-list'
import { normalizeCommerceCurrency } from './commerce-product-records'

/**
 * `GET /api/dashboard/commerce/coupons` - one page of coupons, searched,
 * filtered, sorted and counted by the database, with the summary and
 * breakdowns of every coupon (commerce-coupon-list.ts, stacksjs/stacks#3218).
 * This used to send the newest 500, checked against the first 500 products.
 *
 * The store currency comes with it: fixed amounts are minor units of it, and
 * the page, its table and its dialogs read and write them in it.
 */
export default new Action({
  name: 'CommerceCouponsAction',
  description: 'Returns one page of persisted Coupon records for dashboard management.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const query = parseCouponListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const coupons = await readCouponPage(query)
      return {
        records: coupons.records,
        total: coupons.total,
        page: coupons.page,
        perPage: query.perPage,
        summary: coupons.summary,
        currency: normalizeCommerceCurrency(config.commerce?.currency),
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Coupon records could not be read.', 'CommerceCouponsAction')
    }
  },
})
