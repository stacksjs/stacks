import type { ProductUnitType } from '../../types'
import { db } from '@stacksjs/database'
import { v4 as uuidv4 } from 'uuid'

/**
 * Store a new product unit in the database
 *
 * @param data The product unit data to store
 * @returns The stored product unit with its ID
 */
export async function store(data: Omit<ProductUnitType, 'id' | 'created_at' | 'updated_at'>): Promise<ProductUnitType> {
  try {
    const now = new Date()
    const id = uuidv4()

    // Insert the product unit into the database
    await db
      .insertInto('product_units')
      .values({
        id,
        name: data.name,
        abbreviation: data.abbreviation,
        type: data.type,
        description: data.description || null,
        is_default: data.is_default || false,
        created_at: now,
        updated_at: now,
      })
      .execute()

    // If this unit is set as default, update all other units of the same type to not be default
    if (data.is_default) {
      await db
        .updateTable('product_units')
        .set({ is_default: false })
        .where('type', '=', data.type)
        .where('id', '!=', id)
        .execute()
    }

    // Return the stored product unit
    return {
      id,
      name: data.name,
      abbreviation: data.abbreviation,
      type: data.type,
      description: data.description || null,
      is_default: data.is_default || false,
      created_at: now,
      updated_at: now,
    }
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to store product unit: ${error.message}`)
    }

    throw error
  }
}

/**
 * Store multiple product units at once
 *
 * @param units Array of product unit data to store
 * @returns Array of stored product units with their IDs
 */
export async function bulkStore(units: Array<Omit<ProductUnitType, 'id' | 'created_at' | 'updated_at'>>): Promise<ProductUnitType[]> {
  if (!units.length)
    return []

  try {
    const now = new Date()
    const storedUnits: ProductUnitType[] = []

    // For each unit in the input array
    for (const unit of units) {
      const id = uuidv4()

      // Insert the product unit
      await db
        .insertInto('product_units')
        .values({
          id,
          name: unit.name,
          abbreviation: unit.abbreviation,
          type: unit.type,
          description: unit.description || null,
          is_default: unit.is_default || false,
          created_at: now,
          updated_at: now,
        })
        .execute()

      // If this unit is set as default, update all other units of the same type
      if (unit.is_default) {
        await db
          .updateTable('product_units')
          .set({ is_default: false })
          .where('type', '=', unit.type)
          .where('id', '!=', id)
          .execute()
      }

      // Add the stored unit to our result array
      storedUnits.push({
        id,
        name: unit.name,
        abbreviation: unit.abbreviation,
        type: unit.type,
        description: unit.description || null,
        is_default: unit.is_default || false,
        created_at: now,
        updated_at: now,
      })
    }

    return storedUnits
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to bulk store product units: ${error.message}`)
    }

    throw error
  }
}

/**
 * Format product unit options for dropdown menus or form selection
 * 
 * @param type Optional filter by unit type
 * @returns Array of formatted unit options with id, name, and abbreviation
 */
export async function formatUnitOptions(type?: string): Promise<Array<{
  id: string
  name: string
  abbreviation: string
  is_default: boolean
}>> {
  try {
    let query = db
      .selectFrom('product_units')
      .select(['id', 'name', 'abbreviation', 'is_default'])
      .orderBy('name')

    // Filter by type if provided
    if (type)
      query = query.where('type', '=', type)

    const units = await query.execute()

    return units
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
export async function getDefaultUnit(type: string): Promise<ProductUnitType | undefined> {
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