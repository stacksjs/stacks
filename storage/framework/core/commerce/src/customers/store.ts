import type { CustomerRequestType } from '@stacksjs/orm'
import type { CustomersTable, NewCustomer } from '../../../../orm/src/models/Customer'
import { db } from '@stacksjs/database'

/**
 * Create a new customer
 *
 * @param request The customer data to store
 * @returns The newly created customer record
 */
export async function store(request: CustomerRequestType): Promise<CustomersTable | undefined> {
  const customerData: NewCustomer = {
    name: request.get('name'),
    email: request.get('email'),
    phone: request.get('phone'),
    status: request.get('status') || 'Active',
    avatar: request.get('avatar') || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    user_id: request.get('user_id'),
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
    if (error instanceof Error) {
      if (error.message.includes('Duplicate entry') && error.message.includes('email')) {
        throw new Error('A customer with this email already exists')
      }

      throw new Error(`Failed to create customer: ${error.message}`)
    }

    throw error
  }
}
