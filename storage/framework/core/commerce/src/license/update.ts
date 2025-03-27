// Import dependencies
import { formatDate, type LicenseKeyJsonResponse, type LicenseKeyRequestType } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { fetchById } from './fetch'

/**
 * Update a license key by ID
 *
 * @param id The ID of the license key to update
 * @param request The updated license key data
 * @returns The updated license key record
 */
export async function update(id: number, request: LicenseKeyRequestType): Promise<LicenseKeyJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  // Check if license key exists
  const existingKey = await fetchById(id)

  if (!existingKey) {
    throw new Error(`License key with ID ${id} not found`)
  }

  // Create update data object using request fields
  const updateData = {
    key: request.get('key'),
    status: request.get('status'),
    expiry_date: request.get('expiry_date'),
    template: request.get('template'),
    customer_id: request.get<number>('customer_id'),
    product_id: request.get<number>('product_id'),
    order_id: request.get<number>('order_id'),
  }

  // If no fields to update, just return the existing license key
  if (Object.keys(updateData).length === 0) {
    return existingKey
  }

  try {
    // Update the license key
    await db
      .updateTable('license_keys')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch and return the updated license key
    return await fetchById(id)
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
): Promise<LicenseKeyJsonResponse | undefined> {
  // Check if license key exists
  const licenseKey = await fetchById(id)

  if (!licenseKey) {
    throw new Error(`License key with ID ${id} not found`)
  }

  try {
    // Update the license key status
    await db
      .updateTable('license_keys')
      .set({
        status,
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', id)
      .execute()

    // Fetch the updated license key
    return await fetchById(id)
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
 * @param expiry_date The updated expiry date
 * @returns The updated license key
 */
export async function updateExpiration(
  id: number,
  expiryDate?: string | Date,
): Promise<LicenseKeyJsonResponse | undefined> {
  // Check if license key exists
  const licenseKey = await fetchById(id)

  if (!licenseKey) {
    throw new Error(`License key with ID ${id} not found`)
  }

  // Create update data with only provided fields
  const updateData: Record<string, any> = {
    updated_at: formatDate(new Date()),
  }

  if (expiryDate !== undefined) {
    updateData.expiry_date = expiryDate
  }

  // If no expiration fields to update, just return the existing license key
  if (Object.keys(updateData).length === 1) { // Only updated_at was set
    return licenseKey
  }

  try {
    // Update the license key
    await db
      .updateTable('license_keys')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch the updated license key
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update expiration information: ${error.message}`)
    }

    throw error
  }
}
