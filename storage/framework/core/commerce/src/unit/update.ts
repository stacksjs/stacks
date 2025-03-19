// Import dependencies
import type { ProductUnitRequestType } from '@stacksjs/orm'
import type { ProductUnitJsonResponse } from '../../../../orm/src/models/ProductUnit'
import { db } from '@stacksjs/database'

/**
 * Update an existing product unit
 *
 * @param id The ID of the product unit to update
 * @param request Updated product unit data
 * @returns The updated product unit record
 */
export async function update(id: number, request: ProductUnitRequestType): Promise<ProductUnitJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  try {
    // Prepare unit data for update
    const unitData = {
      name: request.get('name'),
      abbreviation: request.get('abbreviation'),
      type: request.get('type'),
      description: request.get('description'),
      is_default: request.get<boolean>('is_default'),
      updated_at: new Date().toISOString(),
    }

    // Update the product unit
    await db
      .updateTable('product_units')
      .set(unitData)
      .where('id', '=', id)
      .execute()

    // If this unit is set as default, update all other units of the same type
    if (unitData.is_default === true) {
      await db
        .updateTable('product_units')
        .set({ is_default: false })
        .where('type', '=', unitData.type)
        .where('id', '!=', id)
        .execute()
    }

    // Retrieve the updated product unit
    const unit = await db
      .selectFrom('product_units')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()

    return unit
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update product unit: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update multiple product units at once
 *
 * @param updates Array of objects containing unit ID and update data
 * @returns Number of product units updated
 */
export async function bulkUpdate(updates: Array<{
  id: number
  data: ProductUnitRequestType
}>): Promise<number> {
  if (!updates.length)
    return 0

  let updatedCount = 0

  try {
    // Process each product unit update
    await db.transaction().execute(async (trx) => {
      for (const { id, data } of updates) {
        // Validate update data
        await data.validate()

        // Prepare unit data for update
        const unitData = {
          name: data.get<string>('name'),
          abbreviation: data.get<string>('abbreviation'),
          type: data.get<string>('type'),
          description: data.get<string>('description'),
          is_default: data.get<boolean>('is_default'),
          updated_at: new Date().toISOString(),
        }

        // Skip if no fields to update
        if (Object.keys(unitData).length === 0)
          continue

        // Update the product unit
        const result = await trx
          .updateTable('product_units')
          .set(unitData)
          .where('id', '=', id)
          .executeTakeFirst()

        // If this unit is set as default, update all other units of the same type
        if (unitData.is_default === true) {
          await trx
            .updateTable('product_units')
            .set({ is_default: false })
            .where('type', '=', unitData.type)
            .where('id', '!=', id)
            .execute()
        }

        // Increment the counter if update was successful
        if (Number(result.numUpdatedRows) > 0)
          updatedCount++
      }
    })

    return updatedCount
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update product units in bulk: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update the default status of a product unit
 *
 * @param id The ID of the product unit
 * @param isDefault The new default status value
 * @returns True if the status was updated successfully
 */
export async function updateDefaultStatus(id: number, isDefault: boolean): Promise<boolean> {
  try {
    // First get the unit type to update other units if needed
    const unit = await db
      .selectFrom('product_units')
      .select('type')
      .where('id', '=', id)
      .executeTakeFirst()

    if (!unit) {
      return false
    }

    const result = await db
      .updateTable('product_units')
      .set({
        is_default: isDefault,
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', id)
      .executeTakeFirst()

    // If setting this unit as default, update all other units of the same type
    if (isDefault) {
      await db
        .updateTable('product_units')
        .set({ is_default: false })
        .where('type', '=', unit.type)
        .where('id', '!=', id)
        .execute()
    }

    return Number(result.numUpdatedRows) > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update product unit default status: ${error.message}`)
    }

    throw error
  }
}
