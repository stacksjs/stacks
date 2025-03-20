// Import dependencies
import type { ProductVariantRequestType } from '@stacksjs/orm'
import type { NewProductVariant, ProductVariantJsonResponse } from '../../../../orm/src/models/ProductVariant'
import { db } from '@stacksjs/database'

/**
 * Create a new product variant
 *
 * @param request Product variant data to store
 * @returns The newly created product variant record
 */
export async function store(request: ProductVariantRequestType): Promise<ProductVariantJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  try {
    // Prepare variant data
    const variantData: NewProductVariant = {
      product_id: request.get<number>('product_id'),
      variant: request.get('variant'),
      type: request.get('type'),
      description: request.get('description'),
      options: request.get('options'),
      status: request.get('status', 'draft'),
    }

    // Insert the product variant
    const result = await db
      .insertInto('product_variants')
      .values(variantData)
      .executeTakeFirst()

    const variantId = Number(result.insertId) || Number(result.numInsertedOrUpdatedRows)

    // Retrieve the newly created product variant
    const variant = await db
      .selectFrom('product_variants')
      .where('id', '=', variantId)
      .selectAll()
      .executeTakeFirst()

    return variant
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create product variant: ${error.message}`)
    }

    throw error
  }
}

/**
 * Create multiple product variants at once
 *
 * @param requests Array of product variant data to store
 * @returns Number of product variants created
 */
export async function bulkStore(requests: ProductVariantRequestType[]): Promise<number> {
  if (!requests.length)
    return 0

  let createdCount = 0

  try {
    // Process each product variant
    await db.transaction().execute(async (trx) => {
      for (const request of requests) {
        // Validate request data
        await request.validate()

        // Prepare variant data
        const variantData: NewProductVariant = {
          product_id: request.get('product_id'),
          variant: request.get('variant'),
          type: request.get('type'),
          description: request.get('description'),
          options: request.get('options'),
          status: request.get('status', 'draft'),
        }

        await trx
          .insertInto('product_variants')
          .values(variantData)
          .executeTakeFirst()

        createdCount++
      }
    })

    return createdCount
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create product variants in bulk: ${error.message}`)
    }

    throw error
  }
}

/**
 * Generate product variant options from raw input
 *
 * @param rawOptions String array of options
 * @returns Formatted JSON string of options
 */
export function formatVariantOptions(rawOptions: string[]): string {
  if (!rawOptions || !rawOptions.length)
    return JSON.stringify([])

  // Clean and normalize the options
  const cleanedOptions = rawOptions.map(option => option.trim()).filter(Boolean)

  return JSON.stringify(cleanedOptions)
}

/**
 * Create a set of common variant combinations from different option types
 *
 * @param optionSets Object containing option types and their values
 * @returns Array of variant combinations
 *
 * @example
 * // Generate combinations for a t-shirt product
 * const options = {
 *   size: ['S', 'M', 'L'],
 *   color: ['Red', 'Blue']
 * }
 * // Returns: [
 * //   { size: 'S', color: 'Red' },
 * //   { size: 'S', color: 'Blue' },
 * //   { size: 'M', color: 'Red' },
 * //   ...
 * // ]
 */
export function generateVariantCombinations(optionSets: Record<string, string[]>): Record<string, string>[] {
  const keys = Object.keys(optionSets)

  if (!keys.length)
    return []

  // Helper function to create combinations recursively
  function createCombinations(currentIndex: number, currentCombination: Record<string, string>): Record<string, string>[] {
    if (currentIndex === keys.length)
      return [currentCombination]

    const currentKey = keys[currentIndex]
    const currentOptions = optionSets[currentKey]
    const combinations: Record<string, string>[] = []

    for (const option of currentOptions) {
      const newCombination = { ...currentCombination, [currentKey]: option }
      combinations.push(...createCombinations(currentIndex + 1, newCombination))
    }

    return combinations
  }

  return createCombinations(0, {})
}
