type DeliveryRouteJsonResponse = ModelRow<typeof DeliveryRoute>
type NewDeliveryRoute = NewModelData<typeof DeliveryRoute>
type DeliveryRouteInput = NewDeliveryRoute & Partial<{
  delivery_time: number
  last_active: number
  total_distance: number
}>
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { deliveryRouteWriteData } from '../write-data'
import { fetchById } from './fetch'

/**
 * Create a new delivery route
 *
 * @param data The delivery route data to store
 * @returns The newly created delivery route record
 */
export async function store(data: DeliveryRouteInput): Promise<DeliveryRouteJsonResponse> {
  try {
    const uuid = randomUUIDv7()
    const columns = deliveryRouteWriteData(data as Record<string, unknown>)
    const routeData = {
      ...columns,
      last_active: columns.last_active ?? Date.now(),
      uuid,
    }

    await db
      .insertInto('delivery_routes')
      .values(routeData)
      .executeTakeFirst()

    const result = await db
      .selectFrom('delivery_routes')
      .where('uuid', '=', uuid)
      .selectAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create delivery route')

    return result as DeliveryRouteJsonResponse
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
    await db
      .updateTable('delivery_routes')
      .set({
        last_active: Date.now(),
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', id)
      .execute()

    const result = await fetchById(id)
    if (!result)
      throw new Error('Failed to update delivery route last active')

    return result as DeliveryRouteJsonResponse
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update delivery route last active: ${error.message}`)
    }

    throw error
  }
}
