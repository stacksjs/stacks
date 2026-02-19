type PaymentJsonResponse = ModelRow<typeof Payment>
type NewPayment = NewModelData<typeof Payment>
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new payment
 *
 * @param data The payment data to store
 * @returns The newly created payment record
 */
export async function store(data: NewPayment): Promise<PaymentJsonResponse | undefined> {
  const paymentData = {
    ...data,
    status: data.status || 'PENDING',
    currency: data.currency || 'USD',
    uuid: randomUUIDv7(),
  }

  try {
    // Insert the payment record
    const createdPayment = await db
      .insertInto('payments')
      .values(paymentData as NewPayment)
      .executeTakeFirst()

    const insertId = Number(createdPayment.insertId) || Number(createdPayment.numInsertedOrUpdatedRows)

    // If insert was successful, retrieve the newly created payment
    if (insertId) {
      const payment = await db
        .selectFrom('payments')
        .where('id', '=', insertId)
        .selectAll()
        .executeTakeFirst()

      return payment as PaymentJsonResponse | undefined
    }

    return undefined
  }
  catch (error) {
    if (error instanceof Error) {
      // Handle specific error cases
      if (error.message.includes('Duplicate entry') && error.message.includes('transaction_id')) {
        throw new Error('A payment with this transaction ID already exists')
      }

      // Check for insufficient amount errors or other payment-specific validations
      if (error.message.includes('Insufficient funds')) {
        throw new Error('Insufficient funds for this payment')
      }

      throw new Error(`Failed to create payment: ${error.message}`)
    }

    throw error
  }
}
