// Import dependencies
import type { ShippingMethodRequestType } from '@stacksjs/orm'
import type { NewShippingMethod, ShippingMethodJsonResponse } from '../../../../orm/src/models/ShippingMethod'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new shipping method
 *
 * @param request Shipping method data to store
 * @returns The newly created shipping method record
 */
export async function store(request: ShippingMethodRequestType): Promise<ShippingMethodJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  try {
    // Prepare shipping method data
    const shippingData: NewShippingMethod = {
      name: request.get('name'),
      description: request.get('description'),
      base_rate: request.get<number>('base_rate'),
      free_shipping: request.get<number>('free_shipping'),
      status: request.get('status'),
      uuid: randomUUIDv7(),
    }

    // Insert the shipping method
    const result = await db
      .insertInto('shipping_methods')
      .values(shippingData)
      .executeTakeFirst()

    const shippingId = Number(result.insertId)

    // Retrieve the newly created shipping method
    const shippingMethod = await db
      .selectFrom('shipping_methods')
      .where('id', '=', shippingId)
      .selectAll()
      .executeTakeFirst()

    return shippingMethod
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
 * @param requests Array of shipping method data to store
 * @returns Number of shipping methods created
 */
export async function bulkStore(requests: ShippingMethodRequestType[]): Promise<number> {
  if (!requests.length)
    return 0

  let createdCount = 0

  try {
    // Process each shipping method
    await db.transaction().execute(async (trx) => {
      for (const request of requests) {
        // Validate request data
        request.validate()

        // Prepare shipping method data
        const shippingData: NewShippingMethod = {
          name: request.get('name'),
          description: request.get('description'),
          base_rate: request.get<number>('base_rate'),
          free_shipping: request.get<number>('free_shipping'),
          status: request.get('status'),
          uuid: randomUUIDv7(),
        }

        // Insert the shipping method
        await trx
          .insertInto('shipping_methods')
          .values(shippingData)
          .execute()

        createdCount++
      }
    })

    return createdCount
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
    const activeMethods = await db
      .selectFrom('shipping_methods')
      .selectAll()
      .where('status', '=', 'active')
      .orderBy('name')
      .execute()

    return activeMethods
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to get active shipping methods: ${error.message}`)
    }

    throw error
  }
}
