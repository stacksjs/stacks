import type { NewProductVariant, ProductVariantJsonResponse } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new product variant
 *
 * @param data The product variant data to store
 * @returns The newly created product variant record
 */
export async function store(data: NewProductVariant): Promise<ProductVariantJsonResponse> {
  try {
    const variantData = {
      ...data,
      uuid: randomUUIDv7(),
    }

    const result = await db
      .insertInto('product_variants')
      .values(variantData)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create product variant')

    return result
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
 * @param data Array of product variant data to store
 * @returns Number of product variants created
 */
export async function bulkStore(data: NewProductVariant[]): Promise<number> {
  if (!data.length)
    return 0

  let createdCount = 0

  try {
    await db.transaction().execute(async (trx) => {
      for (const variant of data) {
        const variantData = {
          ...variant,
          uuid: randomUUIDv7(),
        }

        await trx
          .insertInto('product_variants')
          .values(variantData)
          .execute()

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
