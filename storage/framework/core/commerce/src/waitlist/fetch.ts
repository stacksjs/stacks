import type { WaitlistProductJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Fetch a waitlist product by ID
 */
export async function fetchById(id: number): Promise<WaitlistProductJsonResponse | undefined> {
  return await db
    .selectFrom('wait_list_products')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch all waitlist products
 */
export async function fetchAll(): Promise<WaitlistProductJsonResponse[]> {
  return await db.selectFrom('wait_list_products').selectAll().execute()
}

/**
 * Fetch the count of waitlist products grouped by source
 * @returns An object containing the count for each source
 */
export async function fetchCountBySource(): Promise<Record<string, number>> {
  const results = await db
    .selectFrom('wait_list_products')
    .select([
      'source',
      eb => eb.fn.count<number>('id').as('count'),
    ])
    .groupBy('source')
    .execute()

  // Convert array to object with source as key and count as value
  return results.reduce((acc, { source, count }) => {
    acc[source] = count
    return acc
  }, {} as Record<string, number>)
}
