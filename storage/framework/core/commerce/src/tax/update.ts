import type { TaxRateJsonResponse, TaxRateUpdate } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Update a tax rate
 *
 * @param id The id of the tax rate to update
 * @param data The tax rate data to update
 * @returns The updated tax rate record
 */
export async function update(id: number, data: TaxRateUpdate): Promise<TaxRateJsonResponse> {
  try {
    if (!id)
      throw new Error('Tax rate ID is required for update')

    const result = await db
      .updateTable('tax_rates')
      .set({
        name: data.name,
        rate: data.rate,
        type: data.type,
        country: data.country,
        region: data.region,
        status: data.status,
        is_default: data.is_default,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update tax rate')

    return result
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
): Promise<TaxRateJsonResponse> {
  try {
    const result = await db
      .updateTable('tax_rates')
      .set({
        status,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update tax rate status')

    return result
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
  rate: number,
): Promise<TaxRateJsonResponse> {
  try {
    const result = await db
      .updateTable('tax_rates')
      .set({
        rate,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update rate information')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update rate information: ${error.message}`)
    }

    throw error
  }
}
