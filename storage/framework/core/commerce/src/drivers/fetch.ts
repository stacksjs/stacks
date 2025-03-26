import type { DriverJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Fetch a driver by ID
 */
export async function fetchById(id: number): Promise<DriverJsonResponse | undefined> {
  return await db
    .selectFrom('drivers')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch all drivers
 */
export async function fetchAll(): Promise<DriverJsonResponse[]> {
  return await db.selectFrom('drivers').selectAll().execute()
}
