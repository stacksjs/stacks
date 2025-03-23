// Import dependencies
import type { ShippingZoneRequestType } from '@stacksjs/orm'
import type { ShippingZoneJsonResponse } from '../../../../orm/src/models/ShippingZone'
import { db } from '@stacksjs/database'
import { fetchById } from './fetch'

/**
 * Update a shipping zone by ID
 *
 * @param id The ID of the shipping zone to update
 * @param request The updated shipping zone data
 * @returns The updated shipping zone record
 */
export async function update(id: number, request: ShippingZoneRequestType): Promise<ShippingZoneJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  // Check if shipping zone exists
  const existingZone = await fetchById(id)

  if (!existingZone) {
    throw new Error(`Shipping zone with ID ${id} not found`)
  }

  // Create update data object using request fields
  const updateData = {
    name: request.get('name'),
    countries: request.get('countries'),
    regions: request.get('regions'),
    postal_codes: request.get('postal_codes'),
    status: request.get('status'),
    shipping_method_id: request.get<number>('shipping_method_id'),
  }

  // If no fields to update, just return the existing shipping zone
  if (Object.keys(updateData).length === 0) {
    return existingZone
  }

  try {
    // Update the shipping zone
    await db
      .updateTable('shipping_zones')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch and return the updated shipping zone
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update shipping zone: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update a shipping zone's status
 *
 * @param id The ID of the shipping zone
 * @param status The new status
 * @returns The updated shipping zone with the new status
 */
export async function updateStatus(
  id: number,
  status: string | string[],
): Promise<ShippingZoneJsonResponse | undefined> {
  // Check if shipping zone exists
  const shippingZone = await fetchById(id)

  if (!shippingZone) {
    throw new Error(`Shipping zone with ID ${id} not found`)
  }

  try {
    // Update the shipping zone status
    await db
      .updateTable('shipping_zones')
      .set({
        status,
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', id)
      .execute()

    // Fetch the updated shipping zone
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update shipping zone status: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update countries for a shipping zone
 *
 * @param id The ID of the shipping zone
 * @param countries The updated countries JSON string
 * @returns The updated shipping zone
 */
export async function updateCountries(
  id: number,
  countries: string,
): Promise<ShippingZoneJsonResponse | undefined> {
  // Check if shipping zone exists
  const shippingZone = await fetchById(id)

  if (!shippingZone) {
    throw new Error(`Shipping zone with ID ${id} not found`)
  }

  try {
    // Update the shipping zone countries
    await db
      .updateTable('shipping_zones')
      .set({
        countries,
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', id)
      .execute()

    // Fetch the updated shipping zone
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update shipping zone countries: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update regions and/or postal codes for a shipping zone
 *
 * @param id The ID of the shipping zone
 * @param regions Optional updated regions JSON string
 * @param postal_codes Optional updated postal codes JSON string
 * @returns The updated shipping zone
 */
export async function updateRegionsAndPostalCodes(
  id: number,
  regions?: string,
  postal_codes?: string,
): Promise<ShippingZoneJsonResponse | undefined> {
  // Check if shipping zone exists
  const shippingZone = await fetchById(id)

  if (!shippingZone) {
    throw new Error(`Shipping zone with ID ${id} not found`)
  }

  // Create update data with only provided fields
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  if (regions !== undefined) {
    updateData.regions = regions
  }

  if (postal_codes !== undefined) {
    updateData.postal_codes = postal_codes
  }

  // If no fields to update, just return the existing shipping zone
  if (Object.keys(updateData).length === 1) { // Only updated_at was set
    return shippingZone
  }

  try {
    // Update the shipping zone
    await db
      .updateTable('shipping_zones')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch the updated shipping zone
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update regions and postal codes: ${error.message}`)
    }

    throw error
  }
}
