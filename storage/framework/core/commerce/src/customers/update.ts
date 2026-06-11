import { db } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { formatDate, isUniqueViolation } from '@stacksjs/orm'
type CustomerJsonResponse = ModelRow<typeof Customer>
type CustomerUpdate = UpdateModelData<typeof Customer>

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

    return result as CustomerJsonResponse
  }
  catch (error) {
    if (error instanceof HttpError)
      throw error
    // Cross-dialect duplicate detection (#1957).
    if (isUniqueViolation(error))
      throw new HttpError(409, 'A customer with this email already exists')
    if (error instanceof Error)
      throw new Error(`Failed to update customer: ${error.message}`)
    throw error
  }
}
