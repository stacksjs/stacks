import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
type ProductUnitJsonResponse = ModelRow<typeof ProductUnit>
type ProductUnitUpdate = UpdateModelData<typeof ProductUnit>

/**
 * Update a product unit
 *
 * @param id The ID of the product unit
 * @param data The product unit data to update
 * @returns The updated product unit record
 */
export async function update(id: number, data: ProductUnitUpdate): Promise<ProductUnitJsonResponse> {
  try {
    if (!id)
      throw new Error('Product unit ID is required for update')

    const result = await db
      .updateTable('product_units')
      .set({
        ...data,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update product unit')

    // If this unit is set as default, update all other units of the same type
    const d = data as Record<string, unknown>
    if (d.is_default === true && data.type) {
      await db
        .updateTable('product_units')
        .set({ is_default: false })
        .where('type', '=', data.type)
        .where('id', '!=', id)
        .execute()
    }

    return result as ProductUnitJsonResponse
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
 * @param data Array of product unit updates
 * @returns Number of product units updated
 */
export async function bulkUpdate(data: ProductUnitUpdate[]): Promise<number> {
  if (!data.length)
    return 0

  let updatedCount = 0

  try {
    for (const unit of data) {
      const unitRecord = unit as Record<string, unknown>
      if (!unitRecord.id)
        continue

      // Support both flat format and { id, data: { ... } } format
      const updateFields = unitRecord.data && typeof unitRecord.data === 'object'
        ? unitRecord.data as Record<string, unknown>
        : { ...unitRecord }
      delete (updateFields as Record<string, unknown>).id

      const result = await db
        .updateTable('product_units')
        .set({
          ...updateFields,
          updated_at: formatDate(new Date()),
        })
        .where('id', '=', unitRecord.id)
        .executeTakeFirst()

      // If this unit is set as default, update all other units of the same type
      const fields = updateFields as Record<string, unknown>
      if (fields.is_default === true && fields.type) {
        await db
          .updateTable('product_units')
          .set({ is_default: false })
          .where('type', '=', fields.type as string)
          .where('id', '!=', unitRecord.id)
          .execute()
      }

      if (Number(result.numUpdatedRows) > 0)
        updatedCount++
    }

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
    return await db.transaction(async (trx: any) => {
      const unit = await trx
        .selectFrom('product_units')
        .select('type')
        .where('id', '=', id)
        .executeTakeFirst() as { type: string } | undefined

      if (!unit)
        return false

      const updatedAt = formatDate(new Date())

      if (isDefault && unit.type) {
        await trx
          .updateTable('product_units')
          .set({ is_default: false, updated_at: updatedAt })
          .where('type', '=', unit.type)
          .where('id', '!=', id)
          .execute()
      }

      await trx
        .updateTable('product_units')
        .set({
          is_default: isDefault,
          updated_at: updatedAt,
        })
        .where('id', '=', id)
        .execute()

      return true
    })
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update product unit default status: ${error.message}`)
    }

    throw error
  }
}
