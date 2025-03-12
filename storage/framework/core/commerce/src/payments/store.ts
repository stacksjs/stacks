import type { PaymentRequestType } from '@stacksjs/orm'
import type { NewPayment, PaymentJsonResponse } from '../../../../orm/src/models/Payment'
import { db } from '@stacksjs/database'

/**
 * Create a new payment
 *
 * @param request The payment data to store
 * @returns The newly created payment record
 */
export async function store(request: PaymentRequestType): Promise<PaymentJsonResponse | undefined> {
  await request.validate()

  const paymentData: NewPayment = {
    order_id: request.get<number>('order_id'),
    user_id: request.get<number>('user_id'),
    amount: request.get<number>('amount'),
    method: request.get('method'),
    status: request.get('status') || 'PENDING',
    currency: request.get('currency') || 'USD',
    reference_number: request.get('reference_number'),
    card_last_four: request.get('card_last_four'),
    card_brand: request.get('card_brand'),
    billing_email: request.get('billing_email'),
    transaction_id: request.get('transaction_id'),
    payment_provider: request.get('payment_provider'),
    refund_amount: request.get<number>('refund_amount'),
    notes: request.get('notes'),
    uuid: request.get('uuid'),
  }

  try {
    // Insert the payment record
    const createdPayment = await db
      .insertInto('payments')
      .values(paymentData)
      .executeTakeFirst()

    // If insert was successful, retrieve the newly created payment
    if (createdPayment.insertId) {
      const payment = await db
        .selectFrom('payments')
        .where('id', '=', Number(createdPayment.insertId))
        .selectAll()
        .executeTakeFirst()

      return payment
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
