import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parseProductVariantListQuery, readProductVariantPage } from './commerce-product-variant-list'

/**
 * `GET /api/dashboard/commerce/variants` - one page of product variants,
 * searched, filtered, sorted and counted by the database, with the summary of
 * every variant, every variant type and every product that has a variant
 * (commerce-product-variant-list.ts, stacksjs/stacks#3218). The dialog
 * searches products through GET /commerce/product-choices; this used to send
 * the first 500 of each.
 */
export default new Action({
  name: 'ProductVariantIndexAction',
  description: 'Returns one page of persisted product variants with their products.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const query = parseProductVariantListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const variants = await readProductVariantPage(query)
      return {
        records: variants.records,
        total: variants.total,
        page: variants.page,
        perPage: query.perPage,
        summary: variants.summary,
        types: variants.types,
        products: variants.products,
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Product variant records could not be read.', 'ProductVariantIndexAction')
    }
  },
})
