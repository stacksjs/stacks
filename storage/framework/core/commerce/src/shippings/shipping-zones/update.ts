import type { ShippingZoneJsonResponse, ShippingZoneUpdate } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Update a shipping zone
 *
 * @param id The ID of the shipping zone
 * @param data The shipping zone data to update
 * @returns The updated shipping zone record
 */
export async function update(id: number, data: ShippingZoneUpdate): Promise<ShippingZoneJsonResponse> {
  try {
    if (!id)
      throw new Error('Shipping zone ID is required for update')

    const result = await db
      .updateTable('shipping_zones')
      .set({
        ...data,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update shipping zone')

    return result
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
): Promise<ShippingZoneJsonResponse> {
  try {
    const result = await db
      .updateTable('shipping_zones')
      .set({
        status,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update shipping zone status')

    return result
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
): Promise<ShippingZoneJsonResponse> {
  try {
    const result = await db
      .updateTable('shipping_zones')
      .set({
        countries,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update shipping zone countries')

    return result
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
): Promise<ShippingZoneJsonResponse> {
  try {
    const updateData: Record<string, any> = {
      updated_at: formatDate(new Date()),
    }

    if (regions !== undefined)
      updateData.regions = regions
    if (postal_codes !== undefined)
      updateData.postal_codes = postal_codes

    const result = await db
      .updateTable('shipping_zones')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update regions and postal codes')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update regions and postal codes: ${error.message}`)
    }

    throw error
  }
}
