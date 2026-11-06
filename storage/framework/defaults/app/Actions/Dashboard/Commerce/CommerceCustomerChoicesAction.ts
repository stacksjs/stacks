import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parseNamedSearchQuery } from '../named-search'
import { searchCustomerChoices } from './commerce-choices'

/**
 * `GET /api/dashboard/commerce/customer-choices?q=` - the customers a commerce
 * dialog offers, searched by the database (commerce-choices.ts,
 * stacksjs/stacks#3218). The waitlist dialogs were handed the first 500.
 */
export default new Action({
  name: 'CommerceCustomerChoicesAction',
  description: 'Searches customers for the commerce dialogs.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const query = parseNamedSearchQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const { choices, total } = await searchCustomerChoices(query)
      return { choices, total, limit: query.limit }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Customers could not be searched.', 'CommerceCustomerChoicesAction')
    }
  },
})
