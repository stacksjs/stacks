import type { Customer, ModelRow, NewModelData } from '@stacksjs/orm'
type CustomerJsonResponse = ModelRow<typeof Customer>
type NewCustomer = NewModelData<typeof Customer>
import { db } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { isUniqueViolation } from '@stacksjs/orm'
import { insertedId } from '../utils/inserted-id'
import { fetchById } from './fetch'

/**
 * Create a new customer
 *
 * @param data The customer data to store
 * @returns The newly created customer record
 */
export async function store(data: NewCustomer): Promise<CustomerJsonResponse> {
  try {
    const customerData = {
      ...data,
      avatar: data.avatar ?? 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&fit=crop&q=60',
    }

    const result = await db
      .insertInto('customers')
      .values(customerData)
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create customer')

    // Read the id the driver reported, never a row count. `insertId ||
    // Number(numInsertedOrUpdatedRows)` produced `NaN` on SQLite, so this
    // returned undefined while declaring a `CustomerJsonResponse`; on a driver
    // that reported the count it would have returned customer 1 instead.
    const id = insertedId(result)

    if (id === undefined)
      throw new Error('Failed to create customer: the database reported no insert id')

    const customerResult = await fetchById(id) as CustomerJsonResponse

    return customerResult
  }
  catch (error) {
    if (error instanceof HttpError)
      throw error
    // Cross-dialect duplicate detection (#1957).
    if (isUniqueViolation(error))
      throw new HttpError(409, 'A customer with this email already exists')
    if (error instanceof Error)
      throw new Error(`Failed to create customer: ${error.message}`)
    throw error
  }
}
