import type { CustomerRequestType } from '@stacksjs/orm'
import type {
  CustomerJsonResponse,
  CustomerUpdate,
} from '../../types'
import { db } from '@stacksjs/database'

/**
 * Update a customer by ID
 *
 * @param id The ID of the customer to update
 * @param request The updated customer data
 * @returns The updated customer record
 */
export async function update(id: number, request: CustomerRequestType): Promise<CustomerJsonResponse | undefined> {
  try {
    await request.validate()
    // Create a single update data object directly from the request
    const updateData: CustomerUpdate = {
      name: request.get('name'),
      email: request.get('email'),
      phone: request.get('phone'),
      total_spent: request.get<number>('totalSpent'),
      last_order: request.get('lastOrder'),
      status: request.get('status'),
      avatar: request.get('avatar'),
      user_id: request.get<number>('user_id'),
    }

    if (Object.keys(updateData).length === 0) {
      return await db
        .selectFrom('customers')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst()
    }

    // Include updated_at timestamp
    updateData.updated_at = new Date()

    // Update the customer record
    await db
      .updateTable('customers')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    const updatedCustomer = await db
      .selectFrom('customers')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()

    return updatedCustomer
  }
  catch (error) {
    // Handle specific errors
    if (error instanceof Error) {
      // Check for unique constraint violation on email
      if (error.message.includes('Duplicate entry') && error.message.includes('email')) {
        throw new Error('A customer with this email already exists')
      }

      // Re-throw the error with a more user-friendly message
      throw new Error(`Failed to update customer: ${error.message}`)
    }

    throw error
  }
}
