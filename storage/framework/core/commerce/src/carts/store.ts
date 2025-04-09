import type { NewCart, CartJsonResponse, CartRequestType } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new cart
 *
 * @param request Cart data to store
 * @returns The newly created cart record
 */
export async function store(request: CartRequestType): Promise<CartJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  try {
    // Prepare cart data
    const cartData: NewCart = {
      status: request.get('status'),
      total_items: request.get('total_items'),
      subtotal: request.get('subtotal'),
      tax_amount: request.get('tax_amount'),
      discount_amount: request.get('discount_amount'),
      total: request.get('total'),
      expires_at: request.get('expires_at'),
      currency: request.get('currency'),
      notes: request.get('notes'),
      applied_coupon_id: request.get('applied_coupon_id'),
      customer_id: request.get('customer_id'),
      coupon_id: request.get('coupon_id'),
    }

    cartData.uuid = randomUUIDv7()

    // Insert the cart
    const result = await db
      .insertInto('carts')
      .values(cartData)
      .executeTakeFirst()

    const cartId = Number(result.insertId) || Number(result.numInsertedOrUpdatedRows)

    // Retrieve the newly created cart
    const cart = await db
      .selectFrom('carts')
      .where('id', '=', cartId)
      .selectAll()
      .executeTakeFirst()

    return cart
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create cart: ${error.message}`)
    }

    throw error
  }
}

/**
 * Create multiple carts at once
 *
 * @param requests Array of cart data to store
 * @returns Number of carts created
 */
export async function bulkStore(requests: CartRequestType[]): Promise<number> {
  if (!requests.length)
    return 0

  let createdCount = 0

  try {
    // Process each cart
    await db.transaction().execute(async (trx) => {
      for (const request of requests) {
        // Validate request data
        request.validate()

        // Prepare cart data
        const cartData: NewCart = {
          status: request.get('status'),
          total_items: request.get('total_items'),
          subtotal: request.get('subtotal'),
          tax_amount: request.get('tax_amount'),
          discount_amount: request.get('discount_amount'),
          total: request.get('total'),
          expires_at: request.get('expires_at'),
          currency: request.get('currency'),
          notes: request.get('notes'),
          applied_coupon_id: request.get('applied_coupon_id'),
          customer_id: request.get('customer_id'),
          coupon_id: request.get('coupon_id'),
        }

        cartData.uuid = randomUUIDv7()

        // Insert the cart
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
    if (error instanceof Error) {
      throw new TypeError(`Failed to create carts in bulk: ${error.message}`)
    }

    throw error
  }
}
