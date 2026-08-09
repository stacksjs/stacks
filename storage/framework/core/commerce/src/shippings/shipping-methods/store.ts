import type { ModelRow, NewModelData, ShippingMethod } from '@stacksjs/orm'
type ShippingMethodJsonResponse = ModelRow<typeof ShippingMethod>
type NewShippingMethod = NewModelData<typeof ShippingMethod>
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { mutationCount } from '../../utils/mutation-count'
import { shippingMethodWriteData } from '../write-data'

/**
 * Create a new shipping method
 *
 * @param data The shipping method data to store
 * @returns The newly created shipping method record
 */
export async function store(data: NewShippingMethod): Promise<ShippingMethodJsonResponse> {
  try {
    const uuid = randomUUIDv7()
    const shippingData = {
      ...shippingMethodWriteData(data as Record<string, unknown>),
      uuid,
    }

    await db
      .insertInto('shipping_methods')
      .values(shippingData)
      .executeTakeFirst()

    const model = await db
      .selectFrom('shipping_methods')
      .where('uuid', '=', uuid)
      .selectAll()
      .executeTakeFirst()
    if (!model)
      throw new Error('Failed to resolve created shipping method')
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
      ...shippingMethodWriteData(item as Record<string, unknown>),
      uuid: randomUUIDv7(),
    }))

    const result = await db
      .insertInto('shipping_methods')
      .values(shippingDataArray)
      .executeTakeFirst()

    return mutationCount(result)
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
      .execute() as any
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
      .execute() as ShippingMethodJsonResponse[]
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to get active shipping methods: ${error.message}`)
    }

    throw error
  }
}
