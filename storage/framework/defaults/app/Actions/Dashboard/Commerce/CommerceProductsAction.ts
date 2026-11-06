import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parseProductListQuery, readProductPage } from './commerce-product-list'
import { normalizeCommerceCurrency } from './commerce-product-records'

/**
 * `GET /api/dashboard/commerce/products` - one page of products, searched,
 * filtered, sorted and counted by the database, with the catalogue summary
 * (commerce-product-list.ts, stacksjs/stacks#3218). It used to return the
 * newest 500 for the browser to do all of that with.
 */
export default new Action({
  name: 'CommerceProductsAction',
  description: 'Returns one page of persisted Product records with native relationship context.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const query = parseProductListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const products = await readProductPage(query)
      return {
        records: products.records,
        total: products.total,
        page: products.page,
        perPage: query.perPage,
        summary: products.summary,
        categories: products.categories,
        manufacturers: products.manufacturers,
        defaultCurrency: normalizeCommerceCurrency(config.commerce?.currency),
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Product records could not be read.', 'CommerceProductsAction')
    }
  },
})
