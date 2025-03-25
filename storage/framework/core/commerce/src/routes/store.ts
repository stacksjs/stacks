// Import dependencies
import type { DeliveryRouteRequestType } from '@stacksjs/orm'
import type { DeliveryRouteJsonResponse, NewDeliveryRoute } from '../../../../orm/src/models/DeliveryRoute'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new delivery route
 *
 * @param request Delivery route data to store
 * @returns The newly created delivery route record
 */
export async function store(request: DeliveryRouteRequestType): Promise<DeliveryRouteJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  try {
    // Prepare delivery route data
    const routeData: NewDeliveryRoute = {
      driver: request.get('driver'),
      vehicle: request.get('vehicle'),
      stops: request.get('stops'),
      delivery_time: request.get('delivery_time'),
      total_distance: request.get('total_distance'),
      last_active: request.get('last_active'),
    }

    // Insert the delivery route
    const result = await db
      .insertInto('delivery_routes')
      .values(routeData)
      .executeTakeFirst()

    const routeId = Number(result.insertId) || Number(result.numInsertedOrUpdatedRows)

    // Retrieve the newly created delivery route
    const deliveryRoute = await db
      .selectFrom('delivery_routes')
      .where('id', '=', routeId)
      .selectAll()
      .executeTakeFirst()

    return deliveryRoute
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create delivery route: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update a delivery route's last active timestamp
 *
 * @param id The ID of the delivery route to update
 * @returns The updated delivery route record
 */
export async function updateLastActive(id: number): Promise<DeliveryRouteJsonResponse | undefined> {
  try {
    const result = await db
      .updateTable('delivery_routes')
      .set({ last_active: new Date().toISOString() })
      .where('id', '=', id)
      .executeTakeFirst()

    if (!result)
      return undefined

    return await db
      .selectFrom('delivery_routes')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update delivery route last active: ${error.message}`)
    }

    throw error
  }
}
