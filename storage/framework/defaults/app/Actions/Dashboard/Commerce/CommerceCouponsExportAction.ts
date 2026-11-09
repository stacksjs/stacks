import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { minorToInput } from '@stacksjs/commerce/money'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { couponsCsv, parseCouponListQuery, readCouponsForExport } from './commerce-coupon-list'
import { normalizeCommerceCurrency } from './commerce-product-records'

/**
 * `GET /api/dashboard/commerce/coupons/export` - every coupon matching the
 * Coupons page's search, filters and sort, as CSV (stacksjs/stacks#3218).
 * The page built the file from the newest 500, with fixed amounts in US
 * dollars whatever the store used.
 */
export default new Action({
  name: 'CommerceCouponsExportAction',
  description: 'Exports every coupon matching the Coupons page filters as CSV.',
  method: 'GET',
  apiResponse: false,

  async handle(request: RequestInstance) {
    const query = parseCouponListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const currency = normalizeCommerceCurrency(config.commerce?.currency)
      const csv = couponsCsv(await readCouponsForExport(query), currency, minorToInput)
      const day = new Date().toISOString().slice(0, 10)
      return new Response(csv, {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Disposition': `attachment; filename="coupons-${day}.csv"`,
          'Content-Type': 'text/csv; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }
    catch (error) {
      return dashboardOperationalError(error, 'Coupons could not be exported.', 'CommerceCouponsExportAction')
    }
  },
})
