import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parseProductUnitListQuery, readProductUnitPage } from './commerce-product-unit-list'

/**
 * `GET /api/dashboard/commerce/units` - one page of product units, searched,
 * filtered, sorted and counted by the database, with the summary of every
 * unit and every unit type (commerce-product-unit-list.ts,
 * stacksjs/stacks#3218). The dialog searches products through
 * GET /commerce/product-choices; this used to send the first 500 of each.
 */
export default new Action({
  name: 'ProductUnitIndexAction',
  description: 'Returns one page of persisted product units with their products.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const query = parseProductUnitListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const units = await readProductUnitPage(query)
      return {
        records: units.records,
        total: units.total,
        page: units.page,
        perPage: query.perPage,
        summary: units.summary,
        types: units.types,
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Product unit records could not be read.', 'ProductUnitIndexAction')
    }
  },
})
