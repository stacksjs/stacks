// Import dependencies
import type { DeliveryRouteRequestType } from '@stacksjs/orm'
import type { DeliveryRouteJsonResponse } from '../../../../orm/src/models/DeliveryRoute'
import { db } from '@stacksjs/database'
import { fetchById } from './fetch'

/**
 * Update a delivery route by ID
 *
 * @param id The ID of the delivery route to update
 * @param request The updated delivery route data
 * @returns The updated delivery route record
 */
export async function update(id: number, request: DeliveryRouteRequestType): Promise<DeliveryRouteJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  // Check if delivery route exists
  const existingRoute = await fetchById(id)

  if (!existingRoute) {
    throw new Error(`Delivery route with ID ${id} not found`)
  }

  // Create update data object using request fields
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  // Add fields only if they are present in the request
  if (request.has('driver')) updateData.driver = request.get('driver')
  if (request.has('vehicle')) updateData.vehicle = request.get('vehicle')
  if (request.has('stops')) updateData.stops = Number(request.get('stops'))
  if (request.has('delivery_time')) updateData.delivery_time = Number(request.get('delivery_time'))
  if (request.has('total_distance')) updateData.total_distance = Number(request.get('total_distance'))
  if (request.has('last_active')) updateData.last_active = request.get('last_active')

  // If no fields to update, just return the existing delivery route
  if (Object.keys(updateData).length === 1) { // Only updated_at was set
    return existingRoute
  }

  try {
    // Update the delivery route
    await db
      .updateTable('delivery_routes')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch and return the updated delivery route
    return await fetchById(id)
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
): Promise<DeliveryRouteJsonResponse | undefined> {
  // Check if delivery route exists
  const deliveryRoute = await fetchById(id)

  if (!deliveryRoute) {
    throw new Error(`Delivery route with ID ${id} not found`)
  }

  try {
    // Update the delivery route stops
    await db
      .updateTable('delivery_routes')
      .set({
        stops,
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', id)
      .execute()

    // Fetch the updated delivery route
    return await fetchById(id)
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
): Promise<DeliveryRouteJsonResponse | undefined> {
  // Check if delivery route exists
  const deliveryRoute = await fetchById(id)

  if (!deliveryRoute) {
    throw new Error(`Delivery route with ID ${id} not found`)
  }

  // Create update data with only provided fields
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  if (delivery_time !== undefined) {
    updateData.delivery_time = delivery_time
  }

  if (total_distance !== undefined) {
    updateData.total_distance = total_distance
  }

  // If no metrics to update, just return the existing delivery route
  if (Object.keys(updateData).length === 1) { // Only updated_at was set
    return deliveryRoute
  }

  try {
    // Update the delivery route
    await db
      .updateTable('delivery_routes')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch the updated delivery route
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update delivery metrics: ${error.message}`)
    }

    throw error
  }
}
