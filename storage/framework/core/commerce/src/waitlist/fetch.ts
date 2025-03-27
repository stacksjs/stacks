import type { WaitlistProductJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { sql } from 'kysely'

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
      (eb) => eb.fn.count<number>('id').as('count'),
    ])
    .groupBy('source')
    .execute()

  // Convert array to object with source as key and count as value
  return results.reduce((acc, { source, count }) => {
    acc[source] = count
    return acc
  }, {} as Record<string, number>)
}

/**
 * Fetch the count of waitlist products for a specific date
 * @param date The date to count entries for (defaults to today)
 * @returns The count of entries for the specified date
 */
export async function fetchCountByDate(date: Date = new Date()): Promise<number> {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  const startDateStr = startOfDay.toISOString().replace('T', ' ').split('.')[0]
  const endDateStr = endOfDay.toISOString().replace('T', ' ').split('.')[0]

  console.log('Start date:', startDateStr)
  console.log('End date:', endDateStr)

  // First, let's see what dates we have in the database
  const sampleDates = await db
    .selectFrom('wait_list_products')
    .select('created_at')
    .execute()

  console.log('Sample dates from DB:', sampleDates)

  const result = await db
    .selectFrom('wait_list_products')
    .select((eb) => eb.fn.count<number>('id').as('count'))
    .where('created_at', '>=', startDateStr)
    .where('created_at', '<=', endDateStr)
    .executeTakeFirst()

  console.log('Query result:', result)

  return result?.count ?? 0
}

/**
 * Fetch the count of waitlist products with a specific quantity
 * @param quantity The quantity to count orders for
 * @returns The count of orders with the specified quantity
 */
export async function fetchCountByQuantity(quantity: number): Promise<number> {
  const result = await db
    .selectFrom('wait_list_products')
    .select((eb) => eb.fn.count<number>('id').as('count'))
    .where('party_size', '=', quantity)
    .executeTakeFirst()

  return result?.count ?? 0
}

/**
 * Fetch the count of waitlist products grouped by quantity
 * @returns An object containing the count for each quantity
 */
export async function fetchCountByAllQuantities(): Promise<Record<number, number>> {
  const results = await db
    .selectFrom('wait_list_products')
    .select([
      'party_size',
      (eb) => eb.fn.count<number>('id').as('count'),
    ])
    .groupBy('party_size')
    .execute()

  // Convert array to object with quantity as key and count as value
  return results.reduce((acc, { party_size, count }) => {
    acc[party_size] = count
    return acc
  }, {} as Record<number, number>)
}
