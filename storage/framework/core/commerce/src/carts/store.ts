type CartJsonResponse = ModelRow<typeof Cart>
type NewCart = NewModelData<typeof Cart>
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
    const cartData = {
      ...data,
      uuid: randomUUIDv7(),
    }

    const result = await db
      .insertInto('carts')
      .values(cartData as NewCart)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create cart')

    return result as CartJsonResponse
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
    await (db as any).transaction().execute(async (trx: any) => {
      for (const cart of data) {
        const cartData = {
          ...cart,
          uuid: randomUUIDv7(),
        }

        await trx
          .insertInto('carts')
          .values(cartData as NewCart)
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
