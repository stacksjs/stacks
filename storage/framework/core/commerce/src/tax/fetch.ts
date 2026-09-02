import type { ModelRow, TaxRate } from '@stacksjs/orm'
type TaxRateJsonResponse = ModelRow<typeof TaxRate>
import { db } from '@stacksjs/database'
import { asModelRow, asModelRows } from '../utils/model-row'

/**
 * Fetch a tax rate by ID
 */
export async function fetchById(id: number): Promise<TaxRateJsonResponse | undefined> {
  const row = await db
    .selectFrom('tax_rates')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()

  return asModelRow<TaxRateJsonResponse>(row, true)
}

/**
 * Fetch all tax rates
 */
export async function fetchAll(): Promise<TaxRateJsonResponse[]> {
  return asModelRows<TaxRateJsonResponse>(await db.selectFrom('tax_rates').selectAll().execute())
}
