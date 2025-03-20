// Import dependencies
import type { ProductVariantRequestType } from '@stacksjs/orm'
import type { ProductVariantJsonResponse } from '../../../../orm/src/models/ProductVariant'
import { db } from '@stacksjs/database'

/**
 * Update an existing product variant
 *
 * @param id The ID of the product variant to update
 * @param request Updated product variant data
 * @returns The updated product variant record
 */
export async function update(id: number, request: ProductVariantRequestType): Promise<ProductVariantJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  try {
    // Prepare variant data for update
    const variantData = {
      variant: request.get('variant'),
      type: request.get('type'),
      description: request.get('description'),
      options: request.get('options'),
      status: request.get('status'),
      updated_at: new Date().toISOString(),
    }

    // Update the product variant
    await db
      .updateTable('product_variants')
      .set(variantData)
      .where('id', '=', id)
      .execute()

    // Retrieve the updated product variant
    const variant = await db
      .selectFrom('product_variants')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()

    return variant
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update product variant: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update multiple product variants at once
 *
 * @param updates Array of objects containing variant ID and update data
 * @returns Number of product variants updated
 */
export async function bulkUpdate(updates: Array<{
  id: number
  data: ProductVariantRequestType
}>): Promise<number> {
  if (!updates.length)
    return 0

  let updatedCount = 0

  try {
    // Process each product variant update
    await db.transaction().execute(async (trx) => {
      for (const { id, data } of updates) {
        // Validate update data
        await data.validate()

        // Prepare variant data for update
        const variantData = {
          variant: data.get<string>('variant'),
          type: data.get<string>('type'),
          description: data.get<string>('description'),
          options: data.get<string>('options'),
          status: data.get<string>('status'),
          updated_at: new Date().toISOString(),
        }

        // Skip if no fields to update
        if (Object.keys(variantData).length === 0)
          continue

        // Update the product variant
        const result = await trx
          .updateTable('product_variants')
          .set(variantData)
          .where('id', '=', id)
          .executeTakeFirst()

        // Increment the counter if update was successful
        if (Number(result.numUpdatedRows) > 0)
          updatedCount++
      }
    })

    return updatedCount
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update product variants in bulk: ${error.message}`)
    }

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
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', id)
      .executeTakeFirst()

    return Number(result.numUpdatedRows) > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update product variant status: ${error.message}`)
    }

    throw error
  }
}
