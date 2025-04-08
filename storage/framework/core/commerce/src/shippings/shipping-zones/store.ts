// Import dependencies
import type { NewShippingZone, ShippingZoneJsonResponse, ShippingZoneRequestType } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new shipping zone
 *
 * @param request Shipping zone data to store
 * @returns The newly created shipping zone record
 */
export async function store(request: ShippingZoneRequestType): Promise<ShippingZoneJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  try {
    // Prepare shipping zone data
    const zoneData: NewShippingZone = {
      name: request.get('name'),
      countries: request.get('countries'),
      regions: request.get('regions'),
      postal_codes: request.get('postal_codes'),
      status: request.get('status'),
      shipping_method_id: request.get<number>('shipping_method_id'),
    }

    zoneData.uuid = randomUUIDv7()

    // Insert the shipping zone
    const result = await db
      .insertInto('shipping_zones')
      .values(zoneData)
      .executeTakeFirst()

    const zoneId = Number(result.insertId) || Number(result.numInsertedOrUpdatedRows)

    // Retrieve the newly created shipping zone
    const shippingZone = await db
      .selectFrom('shipping_zones')
      .where('id', '=', zoneId)
      .selectAll()
      .executeTakeFirst()

    return shippingZone
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create shipping zone: ${error.message}`)
    }

    throw error
  }
}

/**
 * Create multiple shipping zones at once
 *
 * @param requests Array of shipping zone data to store
 * @returns Number of shipping zones created
 */
export async function bulkStore(requests: ShippingZoneRequestType[]): Promise<number> {
  if (!requests.length)
    return 0

  let createdCount = 0

  try {
    // Process each shipping zone
    await db.transaction().execute(async (trx) => {
      for (const request of requests) {
        // Validate request data
        request.validate()

        // Prepare shipping zone data
        const zoneData: NewShippingZone = {
          name: request.get('name'),
          countries: request.get('countries'),
          regions: request.get('regions'),
          postal_codes: request.get('postal_codes'),
          status: request.get('status'),
          shipping_method_id: request.get<number>('shipping_method_id'),
        }

        zoneData.uuid = randomUUIDv7()

        // Insert the shipping zone
        await trx
          .insertInto('shipping_zones')
          .values(zoneData)
          .execute()

        createdCount++
      }
    })

    return createdCount
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create shipping zones in bulk: ${error.message}`)
    }

    throw error
  }
}
