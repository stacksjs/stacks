import type { ShippingRateJsonResponse, ShippingRateUpdate } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Update a shipping rate
 *
 * @param id The shipping rate ID to update
 * @param data The shipping rate data to update
 * @returns The updated shipping rate record
 */
export async function update(id: number, data: ShippingRateUpdate): Promise<ShippingRateJsonResponse> {
  try {
    if (!id)
      throw new Error('Shipping rate ID is required for update')

    const result = await db
      .updateTable('shipping_rates')
      .set({
        ...data,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update shipping rate')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update shipping rate: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update multiple shipping rates at once
 *
 * @param updates Array of objects containing rate ID and update data
 * @returns Number of shipping rates updated
 */
export async function bulkUpdate(updates: Array<{
  id: number
  data: ShippingRateUpdate
}>): Promise<number> {
  if (!updates.length)
    return 0

  try {
    let updatedCount = 0

    for (const { id, data } of updates) {
      const result = await db
        .updateTable('shipping_rates')
        .set({
          ...data,
          updated_at: formatDate(new Date()),
        })
        .where('id', '=', id)
        .executeTakeFirst()

      if (Number(result.numUpdatedRows) > 0)
        updatedCount++
    }

    return updatedCount
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update shipping rates in bulk: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update shipping rates by zone
 *
 * @param zone The zone to update rates for
 * @param data The update data to apply
 * @returns Number of shipping rates updated
 */
export async function updateByZone(zone: number, data: ShippingRateUpdate): Promise<number> {
  try {
    const result = await db
      .updateTable('shipping_rates')
      .set({
        ...data,
        updated_at: formatDate(new Date()),
      })
      .where('zone_id', '=', zone)
      .executeTakeFirst()

    return Number(result.numUpdatedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update shipping rates by zone: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update shipping rates by method
 *
 * @param method The shipping method to update rates for
 * @param data The update data to apply
 * @returns Number of shipping rates updated
 */
export async function updateByMethod(method: string, data: ShippingRateUpdate): Promise<number> {
  try {
    const result = await db
      .updateTable('shipping_rates')
      .set({
        ...data,
        updated_at: formatDate(new Date()),
      })
      .where('method', '=', method)
      .executeTakeFirst()

    return Number(result.numUpdatedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update shipping rates by method: ${error.message}`)
    }

    throw error
  }
}
