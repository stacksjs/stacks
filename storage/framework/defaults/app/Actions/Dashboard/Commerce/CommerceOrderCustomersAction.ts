import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parseNamedSearchQuery, searchNamedRows } from '../named-search'

/**
 * `GET /api/dashboard/commerce/orders/customers?q=` - the customers the order
 * dialog offers, searched by name and email (stacksjs/stacks#3218).
 *
 * The Orders endpoint used to send the first 500 customers by name with every
 * page, so an order could not be given a customer past the 500th.
 */
export default new Action({
  name: 'CommerceOrderCustomersAction',
  description: 'Searches customers by name or email for the order dialog.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const query = parseNamedSearchQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const { rows, total } = await searchNamedRows('customers', query)
      return {
        customers: rows.map(row => ({ id: String(row.id), label: row.name || row.email || `Customer ${row.id}` })),
        total,
        limit: query.limit,
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Customers could not be searched.', 'CommerceOrderCustomersAction')
    }
  },
})
