import { db } from '@stacksjs/database'
import { fetchById } from './fetch'

/**
 * Delete a customer by ID
 *
 * @param id The ID of the customer to delete
 * @returns True if the deletion was successful, false otherwise
 */
export async function destroy(id: number): Promise<boolean> {
  try {
    // First check if the customer exists
    const customer = await fetchById(id)

    if (!customer) {
      throw new Error(`Customer with ID ${id} not found`)
    }

    // Delete the customer
    const result = await db
      .deleteFrom('customers')
      .where('id', '=', id)
      .executeTakeFirst()

    return result.numDeletedRows > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete customer: ${error.message}`)
    }

    throw error
  }
}

/**
 * Bulk delete multiple customers
 *
 * @param ids Array of customer IDs to delete
 * @returns Number of customers successfully deleted
 */
export async function bulkDestroy(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    // Delete all customers in the array
    const result = await db
      .deleteFrom('customers')
      .where('id', 'in', ids)
      .executeTakeFirst()

    return Number(result.numDeletedRows) || 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete customers in bulk: ${error.message}`)
    }

    throw error
  }
}
