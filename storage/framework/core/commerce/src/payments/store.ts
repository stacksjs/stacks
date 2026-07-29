type PaymentJsonResponse = ModelRow<typeof Payment>
type NewPayment = NewModelData<typeof Payment>
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { isUniqueViolation } from '@stacksjs/orm'

/**
 * Create a new payment
 *
 * @param data The payment data to store
 * @returns The newly created payment record
 */
export async function store(data: NewPayment): Promise<PaymentJsonResponse | undefined> {
  const uuid = randomUUIDv7()
  const paymentData = {
    ...data,
    status: data.status || 'pending',
    currency: data.currency || 'USD',
    uuid,
  }

  try {
    await db
      .insertInto('payments')
      .values(paymentData as NewPayment)
      .executeTakeFirst()

    // The model-managed UUID is stable across every supported dialect.
    // Insert metadata is not: SQLite reports lastInsertRowid, MySQL reports
    // insertId, and PostgreSQL requires RETURNING. Reading by UUID avoids
    // treating an affected-row count as a primary key.
    return await db
      .selectFrom('payments')
      .where('uuid', '=', uuid)
      .selectAll()
      .executeTakeFirst() as PaymentJsonResponse | undefined
  }
  catch (error) {
    if (error instanceof HttpError)
      throw error
    // Cross-dialect duplicate detection (#1957) — checked before the
    // insufficient-funds sniff (a duplicate is never an insufficient-funds
    // error, and vice versa, so order is safe).
    if (isUniqueViolation(error))
      throw new HttpError(409, 'A payment with this transaction ID already exists')
    if (error instanceof Error) {
      // Check for insufficient amount errors or other payment-specific validations
      if (error.message.includes('Insufficient funds')) {
        throw new Error('Insufficient funds for this payment')
      }

      throw new Error(`Failed to create payment: ${error.message}`)
    }

    throw error
  }
}
