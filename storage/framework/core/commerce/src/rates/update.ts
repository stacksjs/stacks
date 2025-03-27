import { formatDate, type ShippingRateJsonResponse, type ShippingRateRequestType } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Update an existing shipping rate
 *
 * @param id The ID of the shipping rate to update
 * @param request Updated shipping rate data
 * @returns The updated shipping rate record
 */
export async function update(id: number, request: ShippingRateRequestType): Promise<ShippingRateJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  try {
    // Prepare rate data for update
    const rateData = {
      method: request.get('method'),
      zone: request.get('zone'),
      weight_from: request.get<number>('weight_from'),
      weight_to: request.get<number>('weight_to'),
      rate: request.get<number>('rate'),
      updated_at: formatDate(new Date()),
    }

    // Update the shipping rate
    await db
      .updateTable('shipping_rates')
      .set(rateData)
      .where('id', '=', id)
      .execute()

    // Retrieve the updated shipping rate
    const rate = await db
      .selectFrom('shipping_rates')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()

    return rate
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
  data: ShippingRateRequestType
}>): Promise<number> {
  if (!updates.length)
    return 0

  let updatedCount = 0

  try {
    // Process each shipping rate update
    await db.transaction().execute(async (trx) => {
      for (const { id, data } of updates) {
        // Validate update data
        await data.validate()

        // Prepare rate data for update
        const rateData = {
          method: data.get('method'),
          zone: data.get('zone'),
          weight_from: data.get<number>('weight_from'),
          weight_to: data.get<number>('weight_to'),
          rate: data.get<number>('rate'),
          updated_at: formatDate(new Date()),
        }

        // Skip if no fields to update
        if (Object.keys(rateData).length === 0)
          continue

        // Update the shipping rate
        const result = await trx
          .updateTable('shipping_rates')
          .set(rateData)
          .where('id', '=', id)
          .executeTakeFirst()

        // Increment the counter if update was successful
        if (Number(result.numUpdatedRows) > 0)
          updatedCount++
      }
    })

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
export async function updateByZone(zone: string, data: ShippingRateRequestType): Promise<number> {
  try {
    // Validate the update data
    await data.validate()

    // Prepare rate data for update
    const rateData = {
      method: data.get('method'),
      weight_from: data.get<number>('weight_from'),
      weight_to: data.get<number>('weight_to'),
      rate: data.get<number>('rate'),
      updated_at: formatDate(new Date()),
    }

    // Update all shipping rates for the specified zone
    const result = await db
      .updateTable('shipping_rates')
      .set(rateData)
      .where('zone', '=', zone)
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
export async function updateByMethod(method: string, data: ShippingRateRequestType): Promise<number> {
  try {
    // Validate the update data
    await data.validate()

    // Prepare rate data for update
    const rateData = {
      zone: data.get('zone'),
      weight_from: data.get<number>('weight_from'),
      weight_to: data.get<number>('weight_to'),
      rate: data.get<number>('rate'),
      updated_at: formatDate(new Date()),
    }

    // Update all shipping rates for the specified method
    const result = await db
      .updateTable('shipping_rates')
      .set(rateData)
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
