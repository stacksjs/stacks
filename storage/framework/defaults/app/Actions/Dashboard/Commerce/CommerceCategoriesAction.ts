import { Action } from '@stacksjs/actions'
import { Category } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { normalizeCommerceCategoryRecord, summarizeCommerceCategories } from './commerce-category-records'

export default new Action({
  name: 'CommerceCategoriesAction',
  description: 'Returns persisted product Category records for dashboard management.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const categories = await Category.orderBy('display_order', 'asc').limit(500).get()
      const records = categories.map(normalizeCommerceCategoryRecord)
      const ids = new Set(records.map(record => record.id))
      for (const record of records) {
        if (record.parentCategoryId && !ids.has(record.parentCategoryId))
          throw new TypeError(`Category ${record.id}.parent_category_id references missing Category ${record.parentCategoryId}.`)
      }
      return {
        records,
        summary: summarizeCommerceCategories(records),
      }
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'Category records could not be read.',
      }, 503)
    }
  },
})
