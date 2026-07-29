import { Action } from '@stacksjs/actions'
import { Category } from '@stacksjs/orm'
import { normalizeCommerceCategoryRecord, summarizeCommerceCategories } from './commerce-category-records'

export default new Action({
  name: 'CommerceCategoriesAction',
  description: 'Returns persisted product Category records for dashboard management.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const categories = await Category.orderBy('display_order', 'asc').limit(500).get()
    const records = categories.map(normalizeCommerceCategoryRecord)
    return {
      records,
      summary: summarizeCommerceCategories(records),
    }
  },
})
