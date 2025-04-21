import type { DeliveryRouteJsonResponse, DeliveryRouteUpdate } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Update a delivery route
 *
 * @param id The ID of the delivery route
 * @param data The delivery route data to update
 * @returns The updated delivery route record
 */
export async function update(id: number, data: DeliveryRouteUpdate): Promise<DeliveryRouteJsonResponse> {
  try {
    if (!id)
      throw new Error('Delivery route ID is required for update')

    const result = await db
      .updateTable('delivery_routes')
      .set({
        ...data,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update delivery route')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update delivery route: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update a delivery route's stops count
 *
 * @param id The ID of the delivery route
 * @param stops The new number of stops
 * @returns The updated delivery route with the new stops count
 */
export async function updateStops(
  id: number,
  stops: number,
): Promise<DeliveryRouteJsonResponse> {
  try {
    const result = await db
      .updateTable('delivery_routes')
      .set({
        stops,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update delivery route stops')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update delivery route stops: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update delivery metrics for a route
 *
 * @param id The ID of the delivery route
 * @param delivery_time The updated delivery time
 * @param total_distance The updated total distance
 * @returns The updated delivery route
 */
export async function updateMetrics(
  id: number,
  delivery_time?: number,
  total_distance?: number,
): Promise<DeliveryRouteJsonResponse> {
  try {
    const updateData: Record<string, any> = {
      updated_at: formatDate(new Date()),
    }

    if (delivery_time !== undefined)
      updateData.delivery_time = delivery_time
    if (total_distance !== undefined)
      updateData.total_distance = total_distance

    const result = await db
      .updateTable('delivery_routes')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update delivery metrics')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update delivery metrics: ${error.message}`)
    }

    throw error
  }
}
