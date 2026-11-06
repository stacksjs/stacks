import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parsePosCatalogQuery, parsePosIds, readPosCatalogPage, readPosProducts } from './commerce-pos-catalog'

/**
 * `GET /api/dashboard/commerce/pos/products` - the point of sale catalogue,
 * searched and paged by the database (commerce-pos-catalog.ts,
 * stacksjs/stacks#3218): `q`, `category`, `availability` (sellable or
 * unsellable), `page` and `per_page`. With `ids=1,2,3` it answers exactly
 * those products instead, which is how the cart checks its lines.
 */
export default new Action({
  name: 'CommercePosProductsAction',
  description: 'Searches and pages the point of sale catalogue, or reads the products a cart holds.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const read = (key: string) => request.get<unknown>(key, '')
    const ids = parsePosIds(read)
    if ('error' in ids)
      return response.json({ message: ids.error }, 422)
    const query = parsePosCatalogQuery(read)
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      if (ids.length > 0)
        return { records: await readPosProducts(ids) }
      const catalog = await readPosCatalogPage(query)
      return { records: catalog.products, total: catalog.total, page: catalog.page, perPage: query.perPage }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Point of sale products could not be read.', 'CommercePosProductsAction')
    }
  },
})
