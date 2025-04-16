// Import dependencies
import type { NewProductUnit, ProductUnitJsonResponse } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new product unit
 *
 * @param data The product unit data to store
 * @returns The newly created product unit record
 */
export async function store(data: NewProductUnit): Promise<ProductUnitJsonResponse> {
  try {
    const unitData = {
      ...data,
      uuid: randomUUIDv7(),
    }

    const result = await db
      .insertInto('product_units')
      .values(unitData)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create product unit')

    // If this unit is set as default, update all other units of the same type
    if (unitData.is_default) {
      await db
        .updateTable('product_units')
        .set({ is_default: false })
        .where('type', '=', unitData.type)
        .where('id', '!=', result.id)
        .execute()
    }

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create product unit: ${error.message}`)
    }

    throw error
  }
}

/**
 * Create multiple product units at once
 *
 * @param data Array of product unit data to store
 * @returns Number of product units created
 */
export async function bulkStore(data: NewProductUnit[]): Promise<number> {
  if (!data.length)
    return 0

  let createdCount = 0

  try {
    await db.transaction().execute(async (trx) => {
      for (const unit of data) {
        const unitData = {
          ...unit,
          uuid: randomUUIDv7(),
        }

        const result = await trx
          .insertInto('product_units')
          .values(unitData)
          .returningAll()
          .executeTakeFirst()

        // If this unit is set as default, update all other units of the same type
        if (unitData.is_default && result) {
          await trx
            .updateTable('product_units')
            .set({ is_default: false })
            .where('type', '=', unitData.type)
            .where('id', '!=', result.id)
            .execute()
        }

        createdCount++
      }
    })

    return createdCount
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create product units in bulk: ${error.message}`)
    }

    throw error
  }
}

/**
 * Format product unit options for dropdown menus or selectors
 *
 * @param type Optional filter by unit type
 * @returns Array of formatted unit options with id, name, and abbreviation
 */
export function formatUnitOptions(
  type?: string,
): Promise<{ id: string, name: string, abbreviation: string, is_default: boolean | undefined }[] | []> {
  try {
    let query = db
      .selectFrom('product_units')
      .select(['id', 'name', 'abbreviation', 'is_default'])
      .orderBy('name')

    // Filter by type if provided
    if (type)
      query = query.where('type', '=', type)

    // Convert db results to ensure id is string and handle potentially undefined is_default
    return query.execute().then(results =>
      results.map(result => ({
        id: String(result.id), // Convert id to string
        name: result.name,
        abbreviation: result.abbreviation,
        is_default: result.is_default,
      })),
    )
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to format unit options: ${error.message}`)
    }

    throw error
  }
}

/**
 * Get the default unit for a specific type
 *
 * @param type The unit type to get the default for
 * @returns The default unit or undefined if none found
 */
export async function getDefaultUnit(type: string): Promise<ProductUnitJsonResponse | undefined> {
  try {
    const defaultUnit = await db
      .selectFrom('product_units')
      .selectAll()
      .where('type', '=', type)
      .where('is_default', '=', true)
      .executeTakeFirst()

    return defaultUnit
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to get default unit: ${error.message}`)
    }

    throw error
  }
}
