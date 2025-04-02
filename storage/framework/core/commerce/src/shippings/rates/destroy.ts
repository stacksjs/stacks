import { db } from '@stacksjs/database'

/**
 * Delete a shipping rate by ID
 *
 * @param id The ID of the shipping rate to delete
 * @returns True if the shipping rate was deleted, false otherwise
 */
export async function destroy(id: number): Promise<boolean> {
  try {
    const result = await db
      .deleteFrom('shipping_rates')
      .where('id', '=', id)
      .executeTakeFirst()

    return Number(result.numDeletedRows) > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete shipping rate: ${error.message}`)
    }

    throw error
  }
}

/**
 * Delete multiple shipping rates by ID
 *
 * @param ids Array of shipping rate IDs to delete
 * @returns Number of shipping rates deleted
 */
export async function bulkDestroy(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    // Perform the delete operation
    const result = await db
      .deleteFrom('shipping_rates')
      .where('id', 'in', ids)
      .executeTakeFirst()

    // Return the number of deleted rows
    return Number(result.numDeletedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete shipping rates: ${error.message}`)
    }

    throw error
  }
}

/**
 * Delete shipping rates by zone
 *
 * @param zone The zone to delete shipping rates for
 * @returns Number of shipping rates deleted
 */
export async function destroyByZone(zone: string): Promise<number> {
  try {
    const result = await db
      .deleteFrom('shipping_rates')
      .where('zone', '=', zone)
      .executeTakeFirst()

    return Number(result.numDeletedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete shipping rates by zone: ${error.message}`)
    }

    throw error
  }
}

/**
 * Delete shipping rates by method
 *
 * @param method The shipping method to delete rates for
 * @returns Number of shipping rates deleted
 */
export async function destroyByMethod(method: string): Promise<number> {
  try {
    const result = await db
      .deleteFrom('shipping_rates')
      .where('method', '=', method)
      .executeTakeFirst()

    return Number(result.numDeletedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete shipping rates by method: ${error.message}`)
    }

    throw error
  }
}
