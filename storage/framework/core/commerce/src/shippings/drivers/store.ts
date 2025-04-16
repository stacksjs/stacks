import type { DriverJsonResponse, NewDriver } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new driver
 *
 * @param data The driver data to store
 * @returns The newly created driver record
 */
export async function store(data: NewDriver): Promise<DriverJsonResponse> {
  try {
    const driverData = {
      ...data,
      uuid: randomUUIDv7(),
    }

    const result = await db
      .insertInto('drivers')
      .values(driverData)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create driver')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create driver: ${error.message}`)
    }

    throw error
  }
}

/**
 * Create multiple drivers at once
 *
 * @param data Array of driver data to store
 * @returns Number of drivers created
 */
export async function bulkStore(data: NewDriver[]): Promise<number> {
  if (!data.length)
    return 0

  try {
    const driverDataArray = data.map(item => ({
      ...item,
      uuid: randomUUIDv7(),
    }))

    const result = await db
      .insertInto('drivers')
      .values(driverDataArray)
      .executeTakeFirst()

    return Number(result.numInsertedOrUpdatedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create drivers in bulk: ${error.message}`)
    }

    throw error
  }
}
