import { Action } from '@stacksjs/actions/runtime'
import { dashboardOperationalError } from '../dashboard-response'
import { readCommerceCategories } from './commerce-category-list'

/**
 * `GET /api/dashboard/commerce/categories` - every product category, in
 * display order (commerce-category-list.ts, stacksjs/stacks#3218). It used to
 * read the first 500.
 */
export default new Action({
  name: 'CommerceCategoriesAction',
  description: 'Returns persisted product Category records for dashboard management.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      return await readCommerceCategories()
    }
    catch (error) {
      return dashboardOperationalError(error, 'Category records could not be read.', 'CommerceCategoriesAction')
    }
  },
})
