import type { LicenseKeyJsonResponse, LicenseKeyUpdate } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
// Import dependencies
import { formatDate } from '@stacksjs/orm'

/**
 * Update a license key
 *
 * @param id The ID of the license key
 * @param data The license key data to update
 * @returns The updated license key record
 */
export async function update(id: number, data: LicenseKeyUpdate): Promise<LicenseKeyJsonResponse> {
  try {
    if (!id)
      throw new Error('License key ID is required for update')

    const result = await db
      .updateTable('license_keys')
      .set({
        ...data,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update license key')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update license key: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update a license key's status
 *
 * @param id The ID of the license key
 * @param status The new status
 * @returns The updated license key with the new status
 */
export async function updateStatus(
  id: number,
  status: string | string[],
): Promise<LicenseKeyJsonResponse> {
  try {
    const result = await db
      .updateTable('license_keys')
      .set({
        status,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update license key status')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update license key status: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update expiration information for a license key
 *
 * @param id The ID of the license key
 * @param expiryDate The updated expiry date
 * @returns The updated license key
 */
export async function updateExpiration(
  id: number,
  expiryDate?: string | Date,
): Promise<LicenseKeyJsonResponse> {
  try {
    const updateData: Record<string, any> = {
      updated_at: formatDate(new Date()),
    }

    if (expiryDate !== undefined)
      updateData.expiry_date = expiryDate

    const result = await db
      .updateTable('license_keys')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update expiration information')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update expiration information: ${error.message}`)
    }

    throw error
  }
}
