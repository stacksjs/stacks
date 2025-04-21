import type { CustomerJsonResponse, CustomerUpdate } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Update a customer
 *
 * @param id The ID of the customer to update
 * @param data The customer data to update
 * @returns The updated customer record
 */
export async function update(id: number, data: Omit<CustomerUpdate, 'id'>): Promise<CustomerJsonResponse> {
  try {
    if (!id)
      throw new Error('Customer ID is required for update')

    const result = await db
      .updateTable('customers')
      .set({
        ...data,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update customer')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Duplicate entry') && error.message.includes('email')) {
        throw new Error('A customer with this email already exists')
      }

      throw new Error(`Failed to update customer: ${error.message}`)
    }

    throw error
  }
}
