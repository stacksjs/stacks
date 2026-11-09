import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { normalizeCommerceCustomerCurrency } from './commerce-customer-records'
import { parseCustomerListQuery, readCustomerPage } from './commerce-customer-list'

/**
 * `GET /api/dashboard/commerce/customers` - one page of customers, searched,
 * filtered, sorted and counted by the database, with the summary of every
 * customer (commerce-customer-list.ts, stacksjs/stacks#3218). This used to
 * send the first 500 by name.
 */
export default new Action({
  name: 'CommerceCustomersAction',
  description: 'Returns one page of persisted Customer records and summary values for dashboard management.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const query = parseCustomerListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const customers = await readCustomerPage(query)
      return {
        records: customers.records,
        total: customers.total,
        page: customers.page,
        perPage: query.perPage,
        summary: customers.summary,
        currency: normalizeCommerceCustomerCurrency(config.commerce?.currency),
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Customer records could not be read.', 'CommerceCustomersAction')
    }
  },
})
