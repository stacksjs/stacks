import type { LicenseKey, ModelRow } from '@stacksjs/orm'
type LicenseKeyJsonResponse = ModelRow<typeof LicenseKey>
import { db } from '@stacksjs/database'
import { asModelRow, asModelRows } from '../../utils/model-row'

/**
 * Fetch a shipping method by ID
 */
export async function fetchById(id: number): Promise<LicenseKeyJsonResponse | undefined> {
  const row = await db
    .selectFrom('license_keys')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()

  return asModelRow<LicenseKeyJsonResponse>(row, true)
}

/**
 * Fetch all digital deliveries
 */
export async function fetchAll(): Promise<LicenseKeyJsonResponse[]> {
  return asModelRows<LicenseKeyJsonResponse>(await db.selectFrom('license_keys').selectAll().execute())
}
