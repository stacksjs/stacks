import type { ProductVariantJsonResponse, ProductVariantUpdate } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Update a product variant
 *
 * @param id The ID of the product variant to update
 * @param data The product variant data to update
 * @returns The updated product variant record
 */
export async function update(id: number, data: Omit<ProductVariantUpdate, 'id'>): Promise<ProductVariantJsonResponse> {
  try {
    const result = await db
      .updateTable('product_variants')
      .set({
        ...data,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update product variant')

    return result
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to update product variant: ${error.message}`)

    throw error
  }
}

/**
 * Update multiple product variants at once
 *
 * @param data Array of objects containing variant ID and update data
 * @returns Number of product variants updated
 */
export async function bulkUpdate(data: ProductVariantUpdate[]): Promise<number> {
  if (!data.length)
    return 0

  let updatedCount = 0

  try {
    await db.transaction().execute(async (trx) => {
      for (const variant of data) {
        if (!variant.id)
          continue

        const result = await trx
          .updateTable('product_variants')
          .set({
            ...variant,
            updated_at: formatDate(new Date()),
          })
          .where('id', '=', variant.id)
          .executeTakeFirst()

        if (Number(result.numUpdatedRows) > 0)
          updatedCount++
      }
    })

    return updatedCount
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to update product variants in bulk: ${error.message}`)

    throw error
  }
}

/**
 * Update the status of a product variant
 *
 * @param id The ID of the product variant
 * @param status The new status value
 * @returns True if the status was updated successfully
 */
export async function updateStatus(id: number, status: string): Promise<boolean> {
  try {
    const result = await db
      .updateTable('product_variants')
      .set({
        status,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .executeTakeFirst()

    return Number(result.numUpdatedRows) > 0
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to update product variant status: ${error.message}`)

    throw error
  }
}
