import type { LicenseKeyJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Fetch a shipping method by ID
 */
export async function fetchById(id: number): Promise<LicenseKeyJsonResponse | undefined> {
  return await db
    .selectFrom('license_keys')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch all digital deliveries
 */
export async function fetchAll(): Promise<LicenseKeyJsonResponse[]> {
  return await db.selectFrom('license_keys').selectAll().execute()
}
