import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parseProductWaitlistListQuery, readProductWaitlistPage } from './commerce-product-waitlist-list'

/**
 * `GET /api/dashboard/commerce/waitlist-products` - one page of the product
 * waitlist, searched, filtered, sorted and counted by the database, with the
 * summary of every entry (commerce-product-waitlist-list.ts,
 * stacksjs/stacks#3218). The entry dialog searches its products and customers
 * itself (commerce-choices.ts); this used to send the first 500 of each.
 */
export default new Action({
  name: 'ProductWaitlistIndexAction',
  description: 'Returns one page of native product waitlist records for the dashboard.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const query = parseProductWaitlistListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const entries = await readProductWaitlistPage(query)
      return {
        records: entries.records,
        total: entries.total,
        page: entries.page,
        perPage: query.perPage,
        summary: entries.summary,
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Product waitlist records could not be read.', 'ProductWaitlistIndexAction')
    }
  },
})
