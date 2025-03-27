import type { TaxRateJsonResponse, TaxRateRequestType } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { fetchById } from './fetch'

/**
 * Update a tax rate by ID
 *
 * @param id The ID of the tax rate to update
 * @param request The updated tax rate data
 * @returns The updated tax rate record
 */
export async function update(id: number, request: TaxRateRequestType): Promise<TaxRateJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  // Check if tax rate exists
  const existingRate = await fetchById(id)

  if (!existingRate) {
    throw new Error(`Tax rate with ID ${id} not found`)
  }

  // Create update data object using request fields
  const updateData = {
    name: request.get('name'),
    rate: request.get<number>('rate'),
    type: request.get('type'),
    country: request.get('country'),
    region: request.get('region'),
    status: request.get('status'),
    is_default: request.get<boolean>('is_default'),
    updated_at: formatDate(new Date()),
  }

  // If no fields to update, just return the existing tax rate
  if (Object.keys(updateData).length === 0) {
    return existingRate
  }

  try {
    // Update the tax rate
    await db
      .updateTable('tax_rates')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch and return the updated tax rate
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update tax rate: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update a tax rate's status
 *
 * @param id The ID of the tax rate
 * @param status The new status
 * @returns The updated tax rate with the new status
 */
export async function updateStatus(
  id: number,
  status: 'active' | 'inactive',
): Promise<TaxRateJsonResponse | undefined> {
  // Check if tax rate exists
  const taxRate = await fetchById(id)

  if (!taxRate) {
    throw new Error(`Tax rate with ID ${id} not found`)
  }

  try {
    // Update the tax rate status
    await db
      .updateTable('tax_rates')
      .set({
        status,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .execute()

    // Fetch the updated tax rate
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update tax rate status: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update rate information for a tax rate
 *
 * @param id The ID of the tax rate
 * @param rate The updated rate value
 * @returns The updated tax rate
 */
export async function updateRate(
  id: number,
  rate?: number,
): Promise<TaxRateJsonResponse | undefined> {
  // Check if tax rate exists
  const taxRate = await fetchById(id)

  if (!taxRate) {
    throw new Error(`Tax rate with ID ${id} not found`)
  }

  // Create update data with only provided fields
  const updateData: Record<string, any> = {
    updated_at: formatDate(new Date()),
  }

  if (rate !== undefined) {
    updateData.rate = rate
  }

  // If no rate fields to update, just return the existing tax rate
  if (Object.keys(updateData).length === 1) { // Only updated_at was set
    return taxRate
  }

  try {
    // Update the tax rate
    await db
      .updateTable('tax_rates')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch the updated tax rate
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update rate information: ${error.message}`)
    }

    throw error
  }
}
