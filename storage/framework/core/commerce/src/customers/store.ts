import type { CustomerJsonResponse, NewCustomer } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { fetchById } from './fetch'

/**
 * Create a new customer
 *
 * @param data The customer data to store
 * @returns The newly created customer record
 */
export async function store(data: NewCustomer): Promise<CustomerJsonResponse> {
  try {
    const result = await db
      .insertInto('customers')
      .values(data)
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create customer')

    const insertId = result.insertId || Number(result.numInsertedOrUpdatedRows)

    const customerResult = await fetchById(insertId) as CustomerJsonResponse

    return customerResult
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
