import type { NewProductItem, ProductItemJsonResponse, ProductItemRequestType } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new product item
 *
 * @param request Product item data to store
 * @returns The newly created product item record
 */
export async function store(request: ProductItemRequestType): Promise<ProductItemJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  try {
    // Prepare product item data
    const itemData: NewProductItem = {
      name: request.get('name'),
      size: request.get('size'),
      color: request.get('color'),
      price: request.get('price'),
      image_url: request.get('image_url'),
      is_available: request.get('is_available'),
      inventory_count: request.get('inventory_count'),
      sku: request.get('sku'),
      custom_options: request.get('custom_options'),
      product_id: request.get('product_id'),
      manufacturer_id: request.get('manufacturer_id'),
      category_id: request.get('category_id'),
    }

    itemData.uuid = randomUUIDv7()

    // Insert the product item
    const result = await db
      .insertInto('product_items')
      .values(itemData)
      .executeTakeFirst()

    const itemId = Number(result.insertId) || Number(result.numInsertedOrUpdatedRows)

    // Retrieve the newly created product item
    const productItem = await db
      .selectFrom('product_items')
      .where('id', '=', itemId)
      .selectAll()
      .executeTakeFirst()

    return productItem
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
 * @param requests Array of product item data to store
 * @returns Number of product items created
 */
export async function bulkStore(requests: ProductItemRequestType[]): Promise<number> {
  if (!requests.length)
    return 0

  let createdCount = 0

  try {
    // Process each product item
    await db.transaction().execute(async (trx) => {
      for (const request of requests) {
        // Validate request data
        request.validate()

        // Prepare product item data
        const itemData: NewProductItem = {
          name: request.get('name'),
          size: request.get('size'),
          color: request.get('color'),
          price: request.get('price'),
          image_url: request.get('image_url'),
          is_available: request.get('is_available'),
          inventory_count: request.get('inventory_count'),
          sku: request.get('sku'),
          custom_options: request.get('custom_options'),
          product_id: request.get('product_id'),
          manufacturer_id: request.get('manufacturer_id'),
          category_id: request.get('category_id'),
        }

        itemData.uuid = randomUUIDv7()

        // Insert the product item
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
