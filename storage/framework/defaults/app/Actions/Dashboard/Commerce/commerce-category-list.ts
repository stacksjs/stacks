import type { CommerceSqlRunner } from './commerce-sql'
import { db } from '@stacksjs/database/runtime'
import type { CommerceCategoryRecord, CommerceCategorySummary } from './commerce-category-records'
import { normalizeCommerceCategoryRecord, summarizeCommerceCategories } from './commerce-category-records'
import { sqlRows } from './commerce-sql'

/**
 * Every product category, in display order (stacksjs/stacks#3218).
 *
 * Categories are reference data the page needs whole: it draws them as a
 * tree, offers them as parents in the dialog, and names each one's parent.
 * It used to read the first 500 by display order, so a later category was
 * missing from all of that, and one whose parent was past the 500th failed
 * the whole page with "references missing Category".
 */
export async function readCommerceCategories(run: CommerceSqlRunner = db): Promise<{ records: CommerceCategoryRecord[], summary: CommerceCategorySummary }> {
  // The id breaks display-order ties, so the order is the same on every load.
  const rows = sqlRows(await run.unsafe('SELECT * FROM categories ORDER BY display_order ASC, id ASC').execute())
  const records = rows.map(normalizeCommerceCategoryRecord)
  const ids = new Set(records.map(record => record.id))
  for (const record of records) {
    if (record.parentCategoryId && !ids.has(record.parentCategoryId))
      throw new TypeError(`Category ${record.id}.parent_category_id references missing Category ${record.parentCategoryId}.`)
  }
  return { records, summary: summarizeCommerceCategories(records) }
}
