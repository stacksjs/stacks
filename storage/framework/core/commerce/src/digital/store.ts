// Import dependencies
import type { DigitalDeliveryRequestType } from '@stacksjs/orm'
import type { DigitalDeliveryJsonResponse, NewDigitalDelivery } from '../../../../orm/src/models/DigitalDelivery'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new digital delivery
 *
 * @param request Digital delivery data to store
 * @returns The newly created digital delivery record
 */
export async function store(request: DigitalDeliveryRequestType): Promise<DigitalDeliveryJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  try {
    // Prepare digital delivery data
    const deliveryData: NewDigitalDelivery = {
      name: request.get('name'),
      description: request.get('description'),
      download_limit: request.get('download_limit'),
      expiry_days: request.get('expiry_days'),
      requires_login: request.get('requires_login'),
      automatic_delivery: request.get('automatic_delivery'),
      status: request.get('status'),
    }

    deliveryData.uuid = randomUUIDv7()

    // Insert the digital delivery
    const result = await db
      .insertInto('digital_deliveries')
      .values(deliveryData)
      .executeTakeFirst()

    const deliveryId = Number(result.insertId) || Number(result.numInsertedOrUpdatedRows)

    // Retrieve the newly created digital delivery
    const digitalDelivery = await db
      .selectFrom('digital_deliveries')
      .where('id', '=', deliveryId)
      .selectAll()
      .executeTakeFirst()

    return digitalDelivery
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
 * @param requests Array of digital delivery data to store
 * @returns Number of digital deliveries created
 */
export async function bulkStore(requests: DigitalDeliveryRequestType[]): Promise<number> {
  if (!requests.length)
    return 0

  let createdCount = 0

  try {
    // Process each digital delivery
    await db.transaction().execute(async (trx) => {
      for (const request of requests) {
        // Validate request data
        request.validate()

        // Prepare digital delivery data
        const deliveryData: NewDigitalDelivery = {
          name: request.get('name'),
          description: request.get('description'),
          download_limit: request.get('download_limit'),
          expiry_days: request.get('expiry_days'),
          requires_login: request.get('requires_login'),
          automatic_delivery: request.get('automatic_delivery'),
          status: request.get('status'),
          uuid: randomUUIDv7(),
        }

        // Insert the digital delivery
        await trx
          .insertInto('digital_deliveries')
          .values(deliveryData)
          .execute()

        createdCount++
      }
    })

    return createdCount
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create digital deliveries in bulk: ${error.message}`)
    }

    throw error
  }
}
