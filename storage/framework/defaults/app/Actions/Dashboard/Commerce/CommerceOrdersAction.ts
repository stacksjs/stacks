import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { config } from '@stacksjs/config'
import { Customer } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parseOrderListQuery, readOrderPage } from './commerce-order-list'
import { normalizeOrderCustomerOption } from './commerce-order-records'
import { commerceCurrency } from './commerce-record'

/**
 * `GET /api/dashboard/commerce/orders` - one page of orders, searched, filtered,
 * sorted, counted and summarised by the database (commerce-order-list.ts,
 * stacksjs/stacks#3218). It used to return the newest 500 for the browser to
 * do all of that with.
 */
export default new Action({
  name: 'CommerceOrdersAction',
  description: 'Returns one page of Order records with customer context, item counts and store-wide totals.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const query = parseOrderListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const [orders, customers] = await Promise.all([
        readOrderPage(query),
        // The order dialog's customer choices.
        Customer.orderBy('name', 'asc').limit(500).get(),
      ])
      return {
        records: orders.records,
        total: orders.total,
        page: orders.page,
        perPage: query.perPage,
        summary: orders.summary,
        customers: customers
          .map(normalizeOrderCustomerOption)
          .sort((left, right) => left.label.localeCompare(right.label)),
        statuses: orders.statuses,
        orderTypes: orders.orderTypes,
        defaultCurrency: commerceCurrency(config.commerce?.currency, 'Commerce configuration'),
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Order records could not be read.', 'CommerceOrdersAction')
    }
  },
})
