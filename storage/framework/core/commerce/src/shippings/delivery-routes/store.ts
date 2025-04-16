import type { DeliveryRouteJsonResponse, NewDeliveryRoute } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new delivery route
 *
 * @param data The delivery route data to store
 * @returns The newly created delivery route record
 */
export async function store(data: NewDeliveryRoute): Promise<DeliveryRouteJsonResponse> {
  try {
    const routeData = {
      ...data,
      uuid: randomUUIDv7(),
    }

    const result = await db
      .insertInto('delivery_routes')
      .values(routeData)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create delivery route')

    return result
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
export async function updateLastActive(id: number): Promise<DeliveryRouteJsonResponse> {
  try {
    const result = await db
      .updateTable('delivery_routes')
      .set({
        last_active: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update delivery route last active')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update delivery route last active: ${error.message}`)
    }

    throw error
  }
}
