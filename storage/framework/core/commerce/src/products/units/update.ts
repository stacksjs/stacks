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
    if (data.isDefault === true && data.type) {
      await db
        .updateTable('product_units')
        .set({ isDefault: false })
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
    await db.transaction().execute(async (trx: any) => {
      for (const unit of data) {
        if (!(unit as any).id)
          continue

        const result = await trx
          .updateTable('product_units')
          .set({
            ...unit,
            updated_at: formatDate(new Date()),
          })
          .where('id', '=', (unit as any).id)
          .executeTakeFirst()

        // If this unit is set as default, update all other units of the same type
        if (unit.isDefault === true && unit.type) {
          await trx
            .updateTable('product_units')
            .set({ isDefault: false })
            .where('type', '=', unit.type)
            .where('id', '!=', (unit as any).id)
            .execute()
        }

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
      .select('type' as any)
      .where('id', '=', id)
      .executeTakeFirst() as { type: string } | undefined

    if (!unit)
      return false

    const result = await db
      .updateTable('product_units')
      .set({
        isDefault,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .executeTakeFirst()

    // If setting this unit as default, update all other units of the same type
    if (isDefault && unit.type) {
      await db
        .updateTable('product_units')
        .set({ isDefault: false })
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
