import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { minorToInput } from '@stacksjs/commerce/money'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { normalizeCommerceCustomerCurrency } from './commerce-customer-records'
import { customersCsv, parseCustomerListQuery, readCustomersForExport } from './commerce-customer-list'

/**
 * `GET /api/dashboard/commerce/customers/export` - every customer matching
 * the Customers page's search, filter and sort, as CSV
 * (stacksjs/stacks#3218). The page built the file from the first 500.
 */
export default new Action({
  name: 'CommerceCustomersExportAction',
  description: 'Exports every customer matching the Customers page filters as CSV.',
  method: 'GET',
  apiResponse: false,

  async handle(request: RequestInstance) {
    const query = parseCustomerListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const currency = normalizeCommerceCustomerCurrency(config.commerce?.currency)
      const csv = customersCsv(await readCustomersForExport(query), currency, minorToInput)
      const day = new Date().toISOString().slice(0, 10)
      return new Response(csv, {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Disposition': `attachment; filename="customers-${day}.csv"`,
          'Content-Type': 'text/csv; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }
    catch (error) {
      return dashboardOperationalError(error, 'Customers could not be exported.', 'CommerceCustomersExportAction')
    }
  },
})
