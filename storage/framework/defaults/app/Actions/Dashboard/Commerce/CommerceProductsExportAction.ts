import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { minorToInput } from '@stacksjs/commerce/money'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parseProductListQuery, productsCsv, readProductsForExport } from './commerce-product-list'
import { normalizeCommerceCurrency } from './commerce-product-records'

/**
 * `GET /api/dashboard/commerce/products/export` - every product matching the
 * Products page's search, filters and sort, as CSV (stacksjs/stacks#3218). The
 * page built the file from the newest 500.
 */
export default new Action({
  name: 'CommerceProductsExportAction',
  description: 'Exports every product matching the Products page filters as CSV.',
  method: 'GET',
  apiResponse: false,

  async handle(request: RequestInstance) {
    const query = parseProductListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const currency = normalizeCommerceCurrency(config.commerce?.currency)
      const csv = productsCsv(await readProductsForExport(query), currency, minorToInput)
      const day = new Date().toISOString().slice(0, 10)
      return new Response(csv, {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Disposition': `attachment; filename="products-${day}.csv"`,
          'Content-Type': 'text/csv; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }
    catch (error) {
      return dashboardOperationalError(error, 'Products could not be exported.', 'CommerceProductsExportAction')
    }
  },
})
