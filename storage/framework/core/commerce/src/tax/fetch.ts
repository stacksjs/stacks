import type { TaxRateJsonResponse } from '../../../../orm/src/models/TaxRate'
import { db } from '@stacksjs/database'

/**
 * Fetch a tax rate by ID
 */
export async function fetchById(id: number): Promise<TaxRateJsonResponse | undefined> {
  return await db
    .selectFrom('tax_rates')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch all tax rates
 */
export async function fetchAll(): Promise<TaxRateJsonResponse[]> {
  return await db.selectFrom('tax_rates').selectAll().execute()
}
