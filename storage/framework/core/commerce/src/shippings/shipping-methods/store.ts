import type { NewShippingMethod, ShippingMethodJsonResponse } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { fetchById } from './fetch'

/**
 * Create a new shipping method
 *
 * @param data The shipping method data to store
 * @returns The newly created shipping method record
 */
export async function store(data: NewShippingMethod): Promise<ShippingMethodJsonResponse> {
  try {
    const shippingData = {
      ...data,
      uuid: randomUUIDv7(),
    }

    const result = await db
      .insertInto('shipping_methods')
      .values(shippingData)
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create shipping method')

    const insertId = Number(result.insertId) || Number(result.numInsertedOrUpdatedRows)

    const model = await fetchById(insertId)

    return model as ShippingMethodJsonResponse
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create shipping method: ${error.message}`)
    }

    throw error
  }
}

/**
 * Create multiple shipping methods at once
 *
 * @param data Array of shipping method data to store
 * @returns Number of shipping methods created
 */
export async function bulkStore(data: NewShippingMethod[]): Promise<number> {
  if (!data.length)
    return 0

  try {
    const shippingDataArray = data.map(item => ({
      ...item,
      uuid: randomUUIDv7(),
    }))

    const result = await db
      .insertInto('shipping_methods')
      .values(shippingDataArray)
      .executeTakeFirst()

    return Number(result.numInsertedOrUpdatedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create shipping methods in bulk: ${error.message}`)
    }

    throw error
  }
}

/**
 * Format shipping method options for dropdown menus or selectors
 *
 * @returns Array of formatted shipping method options with id, name, and status
 */
export function formatShippingOptions(): Promise<{ id: number, name: string, status: string | string[], base_rate: number }[]> {
  try {
    return db
      .selectFrom('shipping_methods')
      .select(['id', 'name', 'status', 'base_rate'])
      .orderBy('name')
      .execute()
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to format shipping options: ${error.message}`)
    }

    throw error
  }
}

/**
 * Get active shipping methods
 *
 * @returns List of active shipping methods
 */
export async function getActiveShippingMethods(): Promise<ShippingMethodJsonResponse[]> {
  try {
    return await db
      .selectFrom('shipping_methods')
      .selectAll()
      .where('status', '=', 'active')
      .orderBy('name')
      .execute()
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to get active shipping methods: ${error.message}`)
    }

    throw error
  }
}
