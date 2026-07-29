import { describe, expect, test } from 'bun:test'
import {
  isRefundablePayment,
  normalizePaymentRecord,
  paymentsToCsv,
  summarizePayments,
} from './payment-records'

describe('dashboard payment records', () => {
  test('normalizes native columns and legacy full card numbers', () => {
    const record = normalizePaymentRecord({
      id: 8,
      amount: 12999,
      refund_amount: 2000,
      method: 'creditCard',
      status: 'partiallyRefunded',
      currency: 'USD',
      reference_number: 'REF-8',
      card_last_four: '4111-1111-1111-4242',
      billing_email: 'buyer@example.com',
      payment_provider: 'stripe',
      order_id: 4,
      created_at: '2026-07-29 10:00:00',
    })

    expect(record).toMatchObject({
      id: '8',
      amount: 12999,
      refundAmount: 2000,
      refundRecorded: true,
      cardLastFour: '4242',
      referenceNumber: 'REF-8',
      paymentProvider: 'stripe',
      orderId: '4',
    })
    expect(isRefundablePayment(record)).toBe(true)
  })

  test('summarizes persisted payment states without fabricated comparisons', () => {
    const records = [
      normalizePaymentRecord({ id: 1, amount: 1000, status: 'completed', refund_amount: null }),
      normalizePaymentRecord({ id: 2, amount: 2000, status: 'succeeded', refund_amount: 500 }),
      normalizePaymentRecord({ id: 3, amount: 3000, status: 'failed', refund_amount: null }),
      normalizePaymentRecord({ id: 4, amount: 4000, status: 'pending', refund_amount: null }),
      normalizePaymentRecord({ id: 5, amount: 5000, status: 'refunded', refund_amount: 5000, currency: 'EUR' }),
    ]

    expect(summarizePayments(records)).toEqual({
      total: 5,
      successful: 3,
      currencies: ['EUR', 'USD'],
      capturedByCurrency: { EUR: 5000, USD: 3000 },
      refundedByCurrency: { EUR: 5000, USD: 500 },
      successRate: 75,
    })
  })

  test('exports the current native records as valid CSV', () => {
    const record = normalizePaymentRecord({
      id: 1,
      amount: 1000,
      status: 'completed',
      method: 'creditCard',
      notes: 'Contains, comma',
      billing_email: 'buyer@example.com',
    })

    const csv = paymentsToCsv([record])
    expect(csv.split('\n')).toHaveLength(2)
    expect(csv).toContain('ID,Created,Status,Method')
    expect(csv).toContain('1,,completed,creditCard,1000')
  })
})
