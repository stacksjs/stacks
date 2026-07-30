import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import type { TaxRateWriteData } from './types'
type TaxRateJsonResponse = ModelRow<typeof TaxRate>

/**
 * Update a tax rate
 *
 * @param id The id of the tax rate to update
 * @param data The tax rate data to update
 * @returns The updated tax rate record
 */
export async function update(id: number, data: TaxRateWriteData): Promise<TaxRateJsonResponse> {
  try {
    if (!id)
      throw new Error('Tax rate ID is required for update')

    return await db.transaction(async (trx: any) => {
      const current = await trx
        .selectFrom('tax_rates')
        .select('is_default')
        .where('id', '=', id)
        .executeTakeFirst() as { is_default: boolean | null } | undefined

      if (!current)
        throw new Error(`Tax rate with ID ${id} not found`)

      const isDefault = data.is_default ?? Boolean(current.is_default)
      const updatedAt = formatDate(new Date())
      if (isDefault) {
        await trx
          .updateTable('tax_rates')
          .set({ is_default: false, updated_at: updatedAt })
          .where('id', '!=', id)
          .execute()
      }

      const result = await trx
        .updateTable('tax_rates')
        .set({
          ...data,
          updated_at: updatedAt,
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst()

      if (!result)
        throw new Error(`Tax rate with ID ${id} not found`)

      return result as TaxRateJsonResponse
    })
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

    return result as TaxRateJsonResponse
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

    return result as TaxRateJsonResponse
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update rate information: ${error.message}`)
    }

    throw error
  }
}

/**
 * Select or clear the default tax rate.
 *
 * @param id The ID of the tax rate
 * @param isDefault Whether the tax rate should be the default
 * @returns True when the tax rate exists and was updated
 */
export async function updateDefaultStatus(id: number, isDefault: boolean): Promise<boolean> {
  try {
    return await db.transaction(async (trx: any) => {
      const existing = await trx
        .selectFrom('tax_rates')
        .select('id')
        .where('id', '=', id)
        .executeTakeFirst()

      if (!existing)
        return false

      const updatedAt = formatDate(new Date())
      if (isDefault) {
        await trx
          .updateTable('tax_rates')
          .set({ is_default: false, updated_at: updatedAt })
          .where('id', '!=', id)
          .execute()
      }

      await trx
        .updateTable('tax_rates')
        .set({ is_default: isDefault, updated_at: updatedAt })
        .where('id', '=', id)
        .execute()

      return true
    })
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to update tax rate default status: ${error.message}`)
    throw error
  }
}
