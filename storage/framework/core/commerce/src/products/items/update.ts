import type { ProductItemJsonResponse, ProductItemRequestType } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { fetchById } from './fetch'

/**
 * Update a product item by ID
 *
 * @param id The ID of the product item to update
 * @param request The updated product item data
 * @returns The updated product item record
 */
export async function update(id: number, request: ProductItemRequestType): Promise<ProductItemJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  // Check if product item exists
  const existingItem = await fetchById(id)

  if (!existingItem) {
    throw new Error(`Product item with ID ${id} not found`)
  }

  // Create update data object using request fields
  const updateData = {
    name: request.get('name'),
    size: request.get('size'),
    color: request.get('color'),
    price: request.get<number>('price'),
    image_url: request.get('image_url'),
    is_available: request.get<boolean>('is_available'),
    inventory_count: request.get<number>('inventory_count'),
    sku: request.get('sku'),
    custom_options: request.get('custom_options'),
    product_id: request.get<number>('product_id'),
    manufacturer_id: request.get<number>('manufacturer_id'),
    category_id: request.get<number>('category_id'),
    updated_at: formatDate(new Date()),
  }

  // If no fields to update, just return the existing product item
  if (Object.keys(updateData).length === 0) {
    return existingItem
  }

  try {
    // Update the product item
    await db
      .updateTable('product_items')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch and return the updated product item
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update product item: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update a product item's availability status
 *
 * @param id The ID of the product item
 * @param isAvailable The new availability status
 * @returns The updated product item with the new availability status
 */
export async function updateAvailability(
  id: number,
  isAvailable: boolean,
): Promise<ProductItemJsonResponse | undefined> {
  // Check if product item exists
  const productItem = await fetchById(id)

  if (!productItem) {
    throw new Error(`Product item with ID ${id} not found`)
  }

  try {
    // Update the product item availability
    await db
      .updateTable('product_items')
      .set({
        is_available: isAvailable,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .execute()

    // Fetch the updated product item
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update product item availability: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update inventory information for a product item
 *
 * @param id The ID of the product item
 * @param inventoryCount The updated inventory count
 * @returns The updated product item
 */
export async function updateInventory(
  id: number,
  inventoryCount?: number,
): Promise<ProductItemJsonResponse | undefined> {
  // Check if product item exists
  const productItem = await fetchById(id)

  if (!productItem) {
    throw new Error(`Product item with ID ${id} not found`)
  }

  // Create update data with only provided fields
  const updateData: Record<string, any> = {
    updated_at: formatDate(new Date()),
  }

  if (inventoryCount !== undefined) {
    updateData.inventory_count = inventoryCount
  }

  // If no inventory fields to update, just return the existing product item
  if (Object.keys(updateData).length === 1) { // Only updated_at was set
    return productItem
  }

  try {
    // Update the product item
    await db
      .updateTable('product_items')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch the updated product item
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update inventory information: ${error.message}`)
    }

    throw error
  }
}
