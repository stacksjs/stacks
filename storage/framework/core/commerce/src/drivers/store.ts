// Import dependencies
import type { DriverRequestType } from '@stacksjs/orm'
import type { DriverJsonResponse, NewDriver } from '../../../../orm/src/models/Driver'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new driver
 *
 * @param request Driver data to store
 * @returns The newly created driver record
 */
export async function store(request: DriverRequestType): Promise<DriverJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  try {
    // Prepare driver data
    const driverData: NewDriver = {
      name: request.get('name'),
      phone: request.get('phone'),
      vehicle_number: request.get('vehicle_number'),
      license: request.get('license'),
      status: request.get('status'),
    }

    // Insert the driver
    const result = await db
      .insertInto('drivers')
      .values(driverData)
      .executeTakeFirst()

    const driverId = Number(result.insertId) || Number(result.numInsertedOrUpdatedRows)

    // Retrieve the newly created driver
    const driver = await db
      .selectFrom('drivers')
      .where('id', '=', driverId)
      .selectAll()
      .executeTakeFirst()

    return driver
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
 * @param requests Array of driver data to store
 * @returns Number of drivers created
 */
export async function bulkStore(requests: DriverRequestType[]): Promise<number> {
  if (!requests.length)
    return 0

  let createdCount = 0

  try {
    // Process each driver
    await db.transaction().execute(async (trx) => {
      for (const request of requests) {
        // Validate request data
        request.validate()

        // Prepare driver data
        const driverData: NewDriver = {
          name: request.get('name'),
          phone: request.get('phone'),
          vehicle_number: request.get('vehicle_number'),
          license: request.get('license'),
          status: request.get('status'),
          uuid: randomUUIDv7(),
        }

        // Insert the driver
        await trx
          .insertInto('drivers')
          .values(driverData)
          .execute()

        createdCount++
      }
    })

    return createdCount
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create drivers in bulk: ${error.message}`)
    }

    throw error
  }
}
