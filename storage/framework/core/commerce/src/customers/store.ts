import type { CustomerRequestType } from '@stacksjs/orm'
import type { CustomersTable } from '../../../../orm/src/models/Customer'
import { db } from '@stacksjs/database'

/**
 * Create a new customer
 *
 * @param data The customer data to store
 * @returns The newly created customer record
 */
export async function store(request: CustomerRequestType): Promise<CustomersTable | undefined> {
  // Set default values if not provided
  const customerData = {
    name: request.get('name'),
    email: request.get('email'),
    phone: request.get('phone'),
    orders: Number(request.get('orders')) || 0,
    total_spent: Number(request.get('totalSpent')) || 0,
    last_order: request.get('lastOrder') || new Date().toISOString().split('T')[0],
    status: request.get('status') || 'Active',
    avatar: request.get('avatar') || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    user_id: Number(request.get('user_id')),
  }

  try {
    // Insert the customer record
    const createdCustomer = await db
      .insertInto('customers')
      .values(customerData)
      .executeTakeFirst()

    // If insert was successful, retrieve the newly created customer
    if (createdCustomer.insertId) {
      const customer = await db
        .selectFrom('customers')
        .where('id', '=', Number(createdCustomer.insertId))
        .selectAll()
        .executeTakeFirst()

      return customer
    }

    return undefined
  }
  catch (error) {
    // Handle specific errors
    if (error instanceof Error) {
      // Check for unique constraint violation on email
      if (error.message.includes('Duplicate entry') && error.message.includes('email')) {
        throw new Error('A customer with this email already exists')
      }

      // Re-throw the error with a more user-friendly message
      throw new Error(`Failed to create customer: ${error.message}`)
    }

    throw error
  }
}
