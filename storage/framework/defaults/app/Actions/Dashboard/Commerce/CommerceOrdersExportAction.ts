import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { minorToInput } from '@stacksjs/commerce/money'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { ordersCsv, parseOrderListQuery, readOrdersForExport } from './commerce-order-list'

/**
 * `GET /api/dashboard/commerce/orders/export` - every order matching the Orders
 * page's search, filters and sort, as CSV (stacksjs/stacks#3218).
 *
 * The page used to build the file from the orders it had loaded, so an export
 * held at most the newest 500 orders, whatever the filters matched.
 */
export default new Action({
  name: 'CommerceOrdersExportAction',
  description: 'Exports every order matching the Orders page filters as CSV.',
  method: 'GET',
  apiResponse: false,

  async handle(request: RequestInstance) {
    const query = parseOrderListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const csv = ordersCsv(await readOrdersForExport(query), minorToInput)
      const day = new Date().toISOString().slice(0, 10)
      return new Response(csv, {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Disposition': `attachment; filename="orders-${day}.csv"`,
          'Content-Type': 'text/csv; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }
    catch (error) {
      return dashboardOperationalError(error, 'Orders could not be exported.', 'CommerceOrdersExportAction')
    }
  },
})
