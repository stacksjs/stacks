import type { ProductJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Fetch a product item by ID
 */
export async function fetchById(id: number): Promise<ProductJsonResponse | undefined> {
  const model = await db
    .selectFrom('products')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()

  if (model) {
    let manufacturer = null
    let category = null

    if (model.manufacturer_id) {
      manufacturer = await db
        .selectFrom('manufacturers')
        .where('id', '=', model.manufacturer_id)
        .selectAll()
        .executeTakeFirst()
    }

    if (model.category_id) {
      category = await db
        .selectFrom('categories')
        .where('id', '=', model.category_id)
        .selectAll()
        .executeTakeFirst()
    }

    return {
      ...model,
      manufacturer,
      category,
    }
  }

  return undefined
}

/**
 * Fetch all product items with their manufacturers and categories
 */
export async function fetchAll(): Promise<ProductJsonResponse[]> {
  // Fetch all products
  const models = await db.selectFrom('products').selectAll().execute()

  // Get the IDs of all manufacturers and categories
  const manufacturerIds = models.map(model => model.manufacturer_id).filter(id => id !== null && id !== undefined)
  const categoryIds = models.map(model => model.category_id).filter(id => id !== null && id !== undefined)

  let manufacturersQuery = db.selectFrom('manufacturers')
  let categoriesQuery = db.selectFrom('categories')

  if (manufacturerIds.length > 0) {
    manufacturersQuery = manufacturersQuery.where('id', 'in', manufacturerIds)
  }

  if (categoryIds.length > 0) {
    categoriesQuery = categoriesQuery.where('id', 'in', categoryIds)
  }

  // Fetch manufacturers and categories for these specific IDs using WHERE IN
  const allManufacturers = await manufacturersQuery.selectAll().execute()
  const allCategories = await categoriesQuery.selectAll().execute()

  // Group manufacturers and categories by ID
  const manufacturersById = allManufacturers.reduce((acc, manufacturer) => {
    acc[manufacturer.id] = manufacturer
    return acc
  }, {} as Record<number, typeof allManufacturers[0]>)

  const categoriesById = allCategories.reduce((acc, category) => {
    acc[category.id] = category
    return acc
  }, {} as Record<number, typeof allCategories[0]>)

  // Attach manufacturers and categories to each product
  return models.map(model => ({
    ...model,
    manufacturer: model.manufacturer_id ? manufacturersById[model.manufacturer_id] : null,
    category: model.category_id ? categoriesById[model.category_id] : null,
  }))
}

/**
 * Get products by manufacturer
 *
 * @param manufacturerId Manufacturer identifier
 * @returns List of products for the specified manufacturer
 */
export async function getProductsByManufacturer(manufacturerId: number): Promise<ProductJsonResponse[]> {
  try {
    const products = await db
      .selectFrom('products')
      .selectAll()
      .where('manufacturer_id', '=', manufacturerId)
      .orderBy('name')
      .execute()

    return products
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to get products by manufacturer: ${error.message}`)
    }

    throw error
  }
}

/**
 * Get products by category
 *
 * @param categoryId Category identifier
 * @returns List of products for the specified category
 */
export async function getProductsByCategory(categoryId: number): Promise<ProductJsonResponse[]> {
  try {
    const products = await db
      .selectFrom('products')
      .selectAll()
      .where('category_id', '=', categoryId)
      .orderBy('name')
      .execute()

    return products
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to get products by category: ${error.message}`)
    }

    throw error
  }
}

/**
 * Get product by UUID
 *
 * @param uuid Product UUID
 * @returns Matching product or undefined
 */
export async function getProductByUuid(uuid: string): Promise<ProductJsonResponse | undefined> {
  try {
    const product = await db
      .selectFrom('products')
      .selectAll()
      .where('uuid', '=', uuid)
      .executeTakeFirst()

    return product
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to get product by UUID: ${error.message}`)
    }

    throw error
  }
}

/**
 * Format product options for dropdown menus or selectors
 *
 * @returns Array of formatted product options with id, name, uuid, and price
 */
export async function formatProductOptions(): Promise<{ id: number, name: string, uuid: string, price: number }[]> {
  try {
    const results = await db
      .selectFrom('products')
      .select(['id', 'name', 'uuid', 'price'])
      .orderBy('name')
      .execute()

    // Filter out any results with undefined/null values to match the return type
    return results.filter(result =>
      result.name !== null
      && result.name !== undefined
      && result.uuid !== null
      && result.uuid !== undefined
      && result.price !== null
      && result.price !== undefined,
    ) as { id: number, name: string, uuid: string, price: number }[]
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to format product options: ${error.message}`)
    }

    throw error
  }
}

/**
 * Get products by price range
 *
 * @param minPrice Minimum price
 * @param maxPrice Maximum price
 * @returns List of products within the specified price range
 */
export async function getProductsByPriceRange(minPrice: number, maxPrice: number): Promise<ProductJsonResponse[]> {
  try {
    const products = await db
      .selectFrom('products')
      .selectAll()
      .where('price', '>=', minPrice)
      .where('price', '<=', maxPrice)
      .orderBy('price')
      .execute()

    return products
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to get products by price range: ${error.message}`)
    }

    throw error
  }
}
