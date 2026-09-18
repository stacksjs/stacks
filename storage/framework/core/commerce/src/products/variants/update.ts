import type { ModelRow, ProductVariant, UpdateModelData } from '@stacksjs/orm'
import { db, matchedRows } from '@stacksjs/database'
import { asModelRow } from '../../utils/model-row'
import { formatDate } from '@stacksjs/orm'
type ProductVariantJsonResponse = ModelRow<typeof ProductVariant>
type ProductVariantUpdate = UpdateModelData<typeof ProductVariant>

/**
 * Update a product variant
 *
 * @param id The ID of the product variant to update
 * @param data The product variant data to update
 * @returns The updated product variant record
 */
export async function update(id: number, data: Omit<ProductVariantUpdate, 'id'>): Promise<ProductVariantJsonResponse | undefined> {
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
      return undefined

    return asModelRow<ProductVariantJsonResponse>(result)
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
    for (const variant of data) {
      if (!(variant as Record<string, unknown>).id)
        continue

      // MySQL counts rows CHANGED, and `formatDate` has second precision, so a
      // variant re-saved with the values it already holds inside the same
      // second changed nothing and went uncounted (stacksjs/stacks#2639).
      const matched = await matchedRows(db
        .updateTable('product_variants')
        .set({
          ...variant,
          updated_at: formatDate(new Date()),
        })
        .where('id', '=', (variant as Record<string, unknown>).id))

      if (matched.length > 0)
        updatedCount++
    }

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
    // Setting the status a variant already has changes nothing, and MySQL
    // counts rows CHANGED, so this reported failure for a variant that is
    // right there in the requested state (stacksjs/stacks#2639). `updated_at`
    // does not save it either: `formatDate` has second precision, so a repeat
    // within the same second writes the same value too.
    const matched = await matchedRows(db
      .updateTable('product_variants')
      .set({
        status,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id))

    return matched.length > 0
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to update product variant status: ${error.message}`)

    throw error
  }
}
