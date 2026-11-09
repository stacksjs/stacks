import type { CommerceSqlRunner } from './commerce-sql'
import { db } from '@stacksjs/database/runtime'
import { countOf } from '../Content/content-list'
import { commerceIdentifier, commerceValue } from './commerce-record'
import { sqlRows } from './commerce-sql'
import type { ManufacturerRecord, ManufacturerSummary } from './manufacturer-records'
import { normalizeManufacturerRecord, summarizeManufacturers } from './manufacturer-records'

/**
 * Every manufacturer, newest first, with how many products each one makes
 * (stacksjs/stacks#3218).
 *
 * Manufacturers are reference data, read whole here as the Products page
 * already reads them for its filter and dialog. The page used to read the
 * newest 500, and count products over the first 500 products by id, so an
 * older manufacturer was missing, every count stopped at those 500 products,
 * and a product among them that named a manufacturer past the 500th failed
 * the whole page with "references missing Manufacturer".
 *
 * The products are counted by the database, every one of them. A product
 * whose manufacturer does not exist still fails the page, as before, now
 * whichever product it is.
 */
export async function readManufacturers(run: CommerceSqlRunner = db): Promise<{ records: ManufacturerRecord[], summary: ManufacturerSummary }> {
  const [manufacturers, linked] = await Promise.all([
    run.unsafe('SELECT * FROM manufacturers ORDER BY id DESC').execute(),
    run.unsafe('SELECT manufacturer_id, COUNT(*) AS product_count, MIN(id) AS first_product_id FROM products WHERE manufacturer_id IS NOT NULL GROUP BY manufacturer_id').execute(),
  ])
  const rows = sqlRows(manufacturers)
  const ids = new Set(rows.map(row => commerceIdentifier(commerceValue(row, 'id'), 'Manufacturer')))
  const counts = new Map<string, number>()
  for (const group of sqlRows(linked)) {
    const product = commerceIdentifier(commerceValue(group, 'first_product_id'), 'Product')
    const id = commerceIdentifier(commerceValue(group, 'manufacturer_id'), `Product ${product}`, 'manufacturer_id')
    if (!ids.has(id))
      throw new TypeError(`Product ${product}.manufacturer_id references missing Manufacturer ${id}.`)
    counts.set(id, countOf(group.product_count))
  }
  const records = rows.map(row => normalizeManufacturerRecord(row, counts))
  return { records, summary: summarizeManufacturers(records) }
}
