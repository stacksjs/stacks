import type { CustomersTable } from '../../../../orm/src/models/Customer'
import type { CreateCustomerInput } from '../../types'
import { db } from '@stacksjs/database'

/**
 * Create a new customer
 *
 * @param data The customer data to store
 * @returns The newly created customer record
 */
export async function store(data: CreateCustomerInput): Promise<CustomersTable | undefined> {
  // Set default values if not provided
  const customerData = {
    name: data.name,
    email: data.email,
    phone: data.phone,
    orders: data.orders || 0,
    totalSpent: data.total_spent || 0,
    lastOrder: data.last_order || new Date().toISOString().split('T')[0],
    status: data.status || 'Active',
    avatar: data.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    user_id: data.user_id,
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

/**
 * Create multiple customers at once
 *
 * @param customers Array of customer data to store
 * @returns Number of customers created
 */
export async function bulkStore(customers: CreateCustomerInput[]): Promise<number> {
  if (!customers.length)
    return 0

  try {
    // Prepare customer data with defaults
    const customersData = customers.map(data => ({
      name: data.name,
      email: data.email,
      phone: data.phone,
      orders: data.orders || 0,
      totalSpent: data.total_spent || 0,
      lastOrder: data.last_order || new Date().toISOString().split('T')[0],
      status: data.status || 'Active',
      avatar: data.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
      user_id: data.user_id,
    }))

    // Insert all customers
    const result = await db
      .insertInto('customers')
      .values(customersData)
      .execute()

    // Return the number of affected rows
    return result.length || 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create customers in bulk: ${error.message}`)
    }

    throw error
  }
}
