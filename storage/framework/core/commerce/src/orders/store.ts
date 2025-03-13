// Import dependencies
import type { ProductUnitRequestType } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import type { NewProductUnit, ProductUnitJsonResponse } from '../../../../orm/src/models/ProductUnit'

/**
 * Create a new product unit
 *
 * @param request Product unit data to store
 * @returns The newly created product unit record
 */
export async function store(request: ProductUnitRequestType): Promise<ProductUnitJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  try {
    // Prepare product unit data
    const unitData: NewProductUnit = {
      name: request.get('name'),
      product_id: request.get<number>('product_id'),
      abbreviation: request.get('abbreviation'),
      type: request.get('type'),
      description: request.get('description'),
      is_default: request.get<boolean>('is_default', false),
    }

    // Insert the product unit
    const result = await db
      .insertInto('product_units')
      .values(unitData)
      .executeTakeFirst()

    const unitId = Number(result.insertId)

    // If this unit is set as default, update all other units of the same type
    if (unitData.is_default) {
      await db
        .updateTable('product_units')
        .set({ is_default: false })
        .where('type', '=', unitData.type)
        .where('id', '!=', unitId)
        .execute()
    }

    // Retrieve the newly created product unit
    const unit = await db
      .selectFrom('product_units')
      .where('id', '=', unitId)
      .selectAll()
      .executeTakeFirst()

    return unit
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
 * @param requests Array of product unit data to store
 * @returns Number of product units created
 */
export async function bulkStore(requests: ProductUnitRequestType[]): Promise<number> {
  if (!requests.length)
    return 0

  let createdCount = 0

  try {
    // Process each product unit
    await db.transaction().execute(async (trx) => {
      for (const request of requests) {
        // Validate request data
        request.validate()

        // Prepare product unit data
        const unitData: NewProductUnit = {
          name: request.get('name'),
          product_id: request.get<number>('product_id'),
          abbreviation: request.get('abbreviation'),
          type: request.get('type'),
          description: request.get('description'),
          is_default: request.get('is_default') || false,
        }

        // Insert the product unit
        const result = await trx
          .insertInto('product_units')
          .values(unitData)
          .executeTakeFirst()

        const unitId = Number(result.insertId)
        
        // If this unit is set as default, update all other units of the same type
        if (unitData.is_default) {
          await trx
            .updateTable('product_units')
            .set({ is_default: false })
            .where('type', '=', unitData.type)
            .where('id', '!=', unitId)
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
): Promise<{ id: number, name: string, abbreviation: string, is_default: boolean | undefined }[]> {
  try {
    let query = db
      .selectFrom('product_units')
      .select(['id', 'name', 'abbreviation', 'is_default'])
      .orderBy('name')

    // Filter by type if provided
    if (type)
      query = query.where('type', '=', type)

    return query.execute()
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