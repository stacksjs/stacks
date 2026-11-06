import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parseNamedSearchQuery } from '../named-search'
import { searchProductChoices } from './commerce-choices'

/**
 * `GET /api/dashboard/commerce/product-choices?q=` - the products a commerce
 * dialog offers, searched by the database (commerce-choices.ts,
 * stacksjs/stacks#3218). The waitlist dialogs were handed the first 500.
 */
export default new Action({
  name: 'CommerceProductChoicesAction',
  description: 'Searches products for the commerce dialogs.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const query = parseNamedSearchQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const { choices, total } = await searchProductChoices(query)
      return { choices, total, limit: query.limit }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Products could not be searched.', 'CommerceProductChoicesAction')
    }
  },
})
