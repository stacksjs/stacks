// Import dependencies
import type { ShippingRateRequestType } from '@stacksjs/orm'
import type { NewShippingRate, ShippingRateJsonResponse } from '../../../../orm/src/models/ShippingRate'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new shipping rate
 *
 * @param request Shipping rate data to store
 * @returns The newly created shipping rate record
 */
export async function store(request: ShippingRateRequestType): Promise<ShippingRateJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  try {
    // Prepare shipping rate data
    const shippingRateData: NewShippingRate = {
      method: request.get('method'),
      zone: request.get('zone'),
      weight_from: request.get<number>('weight_from'),
      weight_to: request.get<number>('weight_to'),
      rate: request.get<number>('rate'),
      uuid: randomUUIDv7(),
    }

    // Insert the shipping rate
    const result = await db
      .insertInto('shipping_rates')
      .values(shippingRateData)
      .executeTakeFirst()

    const rateId = Number(result.insertId) || Number(result.numInsertedOrUpdatedRows)

    // Retrieve the newly created shipping rate
    const shippingRate = await db
      .selectFrom('shipping_rates')
      .where('id', '=', rateId)
      .selectAll()
      .executeTakeFirst()

    return shippingRate
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create shipping rate: ${error.message}`)
    }

    throw error
  }
}

/**
 * Create multiple shipping rates at once
 *
 * @param requests Array of shipping rate data to store
 * @returns Number of shipping rates created
 */
export async function bulkStore(requests: ShippingRateRequestType[]): Promise<number> {
  if (!requests.length)
    return 0

  let createdCount = 0

  try {
    // Process each shipping rate
    await db.transaction().execute(async (trx) => {
      for (const request of requests) {
        // Validate request data
        request.validate()

        // Prepare shipping rate data
        const shippingRateData: NewShippingRate = {
          method: request.get('method'),
          zone: request.get('zone'),
          weight_from: request.get<number>('weight_from'),
          weight_to: request.get<number>('weight_to'),
          rate: request.get<number>('rate'),
          uuid: randomUUIDv7(),
        }

        // Insert the shipping rate
        await trx
          .insertInto('shipping_rates')
          .values(shippingRateData)
          .execute()

        createdCount++
      }
    })

    return createdCount
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create shipping rates in bulk: ${error.message}`)
    }

    throw error
  }
}

/**
 * Format shipping rate options for dropdown menus or selectors
 *
 * @returns Array of formatted shipping rate options with id, method, zone, and rate
 */
export function formatShippingRateOptions(): Promise<{ id: number, method: string, zone: string, rate: number }[]> {
  try {
    return db
      .selectFrom('shipping_rates')
      .select(['id', 'method', 'zone', 'rate'])
      .orderBy('method')
      .execute()
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to format shipping rate options: ${error.message}`)
    }

    throw error
  }
}

/**
 * Get shipping rates for a specific method
 *
 * @param method The shipping method to filter by
 * @returns List of shipping rates for the specified method
 */
export async function getShippingRatesByMethod(method: string): Promise<ShippingRateJsonResponse[]> {
  try {
    const rates = await db
      .selectFrom('shipping_rates')
      .selectAll()
      .where('method', '=', method)
      .orderBy('weight_from')
      .execute()

    return rates
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to get shipping rates by method: ${error.message}`)
    }

    throw error
  }
} 