import type { NewProductItem, ProductItemJsonResponse } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new product item
 *
 * @param data The product item data to store
 * @returns The newly created product item record
 */
export async function store(data: NewProductItem): Promise<ProductItemJsonResponse> {
  try {
    const itemData = {
      ...data,
      uuid: randomUUIDv7(),
    }

    const result = await db
      .insertInto('product_items')
      .values(itemData)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create product item')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create product item: ${error.message}`)
    }

    throw error
  }
}

/**
 * Create multiple product items at once
 *
 * @param data Array of product item data to store
 * @returns Number of product items created
 */
export async function bulkStore(data: NewProductItem[]): Promise<number> {
  if (!data.length)
    return 0

  let createdCount = 0

  try {
    await db.transaction().execute(async (trx) => {
      for (const item of data) {
        const itemData = {
          ...item,
          uuid: randomUUIDv7(),
        }

        await trx
          .insertInto('product_items')
          .values(itemData)
          .execute()

        createdCount++
      }
    })

    return createdCount
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create product items in bulk: ${error.message}`)
    }

    throw error
  }
}
