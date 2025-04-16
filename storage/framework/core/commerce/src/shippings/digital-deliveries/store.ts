import type { NewDigitalDelivery, DigitalDeliveryJsonResponse } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new digital delivery
 *
 * @param data The digital delivery data to store
 * @returns The newly created digital delivery record
 */
export async function store(data: NewDigitalDelivery): Promise<DigitalDeliveryJsonResponse> {
  try {
    const deliveryData = {
      ...data,
      uuid: randomUUIDv7(),
    }

    const result = await db
      .insertInto('digital_deliveries')
      .values(deliveryData)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create digital delivery')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create digital delivery: ${error.message}`)
    }

    throw error
  }
}

/**
 * Create multiple digital deliveries at once
 *
 * @param data Array of digital delivery data to store
 * @returns Number of digital deliveries created
 */
export async function bulkStore(data: NewDigitalDelivery[]): Promise<number> {
  if (!data.length)
    return 0

  try {
    const deliveryDataArray = data.map(item => ({
      ...item,
      uuid: randomUUIDv7(),
    }))

    const result = await db
      .insertInto('digital_deliveries')
      .values(deliveryDataArray)
      .executeTakeFirst()

    return Number(result.numInsertedOrUpdatedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create digital deliveries in bulk: ${error.message}`)
    }

    throw error
  }
}
