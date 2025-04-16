import type { CartJsonResponse, NewCart } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new cart
 *
 * @param data Cart data to store
 * @returns The newly created cart record
 */
export async function store(data: NewCart): Promise<CartJsonResponse> {
  try {
    const cartData: NewCart = {
      ...data,
      uuid: randomUUIDv7(),
    }

    const result = await db
      .insertInto('carts')
      .values(cartData)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create cart')

    return result
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to create cart: ${error.message}`)

    throw error
  }
}

/**
 * Create multiple carts at once
 *
 * @param data Array of cart data to store
 * @returns Number of carts created
 */
export async function bulkStore(data: NewCart[]): Promise<number> {
  if (!data.length)
    return 0

  let createdCount = 0

  try {
    await db.transaction().execute(async (trx) => {
      for (const cart of data) {
        const cartData: NewCart = {
          ...cart,
          uuid: randomUUIDv7(),
        }

        await trx
          .insertInto('carts')
          .values(cartData)
          .execute()

        createdCount++
      }
    })

    return createdCount
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to create carts in bulk: ${error.message}`)

    throw error
  }
}
