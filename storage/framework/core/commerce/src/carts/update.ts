import type { CartJsonResponse, CartUpdate } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Update a cart
 *
 * @param id The ID of the cart to update
 * @param data The cart data to update
 * @returns The updated cart record
 */
export async function update(id: number, data: Omit<CartUpdate, 'id'>): Promise<CartJsonResponse> {
  try {
    const result = await db
      .updateTable('carts')
      .set({
        ...data,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update cart')

    return result
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to update cart: ${error.message}`)

    throw error
  }
}

/**
 * Update multiple carts at once
 *
 * @param data Array of objects containing cart ID and update data
 * @returns Number of carts updated
 */
export async function bulkUpdate(data: CartUpdate[]): Promise<number> {
  if (!data.length)
    return 0

  let updatedCount = 0

  try {
    await db.transaction().execute(async (trx) => {
      for (const cart of data) {
        if (!cart.id)
          continue

        const result = await trx
          .updateTable('carts')
          .set({
            ...cart,
            updated_at: formatDate(new Date()),
          })
          .where('id', '=', cart.id)
          .executeTakeFirst()

        if (Number(result.numUpdatedRows) > 0)
          updatedCount++
      }
    })

    return updatedCount
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to update carts in bulk: ${error.message}`)

    throw error
  }
}
