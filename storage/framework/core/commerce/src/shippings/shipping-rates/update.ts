import type { ModelRow, ShippingRate, UpdateModelData } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { asModelRow } from '../../utils/model-row'
import { formatDate } from '@stacksjs/orm'
import { mutationCount } from '../../utils/mutation-count'
import { shippingRateWriteData } from '../write-data'
import { ShippingRateInputError, validateShippingRateWrite } from './validate-write'
type ShippingRateJsonResponse = ModelRow<typeof ShippingRate>
type ShippingRateUpdate = UpdateModelData<typeof ShippingRate>

/**
 * Update a shipping rate
 *
 * @param id The shipping rate ID to update
 * @param data The shipping rate data to update
 * @returns The updated shipping rate record
 */
export async function update(id: number, data: ShippingRateUpdate): Promise<ShippingRateJsonResponse | undefined> {
  try {
    if (!id)
      throw new Error('Shipping rate ID is required for update')

    const current = await db
      .selectFrom('shipping_rates')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()
    if (!current)
      return undefined

    const input = shippingRateWriteData(data as Record<string, unknown>)
    await validateShippingRateWrite(input, current as Record<string, unknown>)

    const result = await db
      .updateTable('shipping_rates')
      .set({
        ...input,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      return undefined

    return asModelRow<ShippingRateJsonResponse>(result)
  }
  catch (error) {
    if (error instanceof ShippingRateInputError)
      throw error
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
          ...shippingRateWriteData(data as Record<string, unknown>),
          updated_at: formatDate(new Date()),
        })
        .where('id', '=', id)
        .executeTakeFirst()

      if (mutationCount(result) > 0)
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
        ...shippingRateWriteData(data as Record<string, unknown>),
        updated_at: formatDate(new Date()),
      })
      .where('shipping_zone_id', '=', zone)
      .executeTakeFirst()

    return mutationCount(result)
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
export async function updateByMethod(method: number, data: ShippingRateUpdate): Promise<number> {
  try {
    const result = await db
      .updateTable('shipping_rates')
      .set({
        ...shippingRateWriteData(data as Record<string, unknown>),
        updated_at: formatDate(new Date()),
      })
      .where('shipping_method_id', '=', method)
      .executeTakeFirst()

    return mutationCount(result)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update shipping rates by method: ${error.message}`)
    }

    throw error
  }
}
