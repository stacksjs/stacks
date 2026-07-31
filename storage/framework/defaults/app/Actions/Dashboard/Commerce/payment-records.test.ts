import { describe, expect, test } from 'bun:test'
import {
  isRefundablePayment,
  normalizePaymentRecord,
  paymentsToCsv,
  summarizePayments,
} from './payment-records'

function payment(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 8,
    amount: 12999,
    refund_amount: null,
    method: 'creditCard',
    status: 'completed',
    currency: 'USD',
    reference_number: null,
    card_last_four: null,
    card_brand: null,
    billing_email: null,
    transaction_id: null,
    payment_provider: null,
    notes: null,
    order_id: null,
    customer_id: null,
    created_at: '2026-07-29 10:00:00',
    ...overrides,
  }
}

describe('dashboard payment records', () => {
  test('normalizes native columns and securely reduces legacy full card numbers', () => {
    const record = normalizePaymentRecord(payment({
      refund_amount: 2000,
      status: 'partiallyRefunded',
      reference_number: 'REF-8',
      card_last_four: '4111-1111-1111-4242',
      billing_email: 'buyer@example.com',
      payment_provider: 'stripe',
      order_id: 4,
    }), { orderIds: new Set(['4']) })

    expect(record).toMatchObject({
      id: '8',
      amount: 12999,
      refundAmount: 2000,
      refundRecorded: true,
      cardLastFour: '4242',
      referenceNumber: 'REF-8',
      paymentProvider: 'stripe',
      orderId: '4',
      createdAt: '2026-07-29T10:00:00.000Z',
    })
    expect(isRefundablePayment(record)).toBe(true)
  })

  test('rejects malformed values and missing relationships', () => {
    expect(() => normalizePaymentRecord(payment({
      amount: 10.5,
    }))).toThrow('Payment 8.amount must be an integer')
    expect(() => normalizePaymentRecord(payment({
      card_last_four: 'not-card-data',
    }))).toThrow('must contain only card digits and separators')
    expect(() => normalizePaymentRecord(payment({
      refund_amount: 15000,
    }))).toThrow('refund_amount must not exceed amount')
    expect(() => normalizePaymentRecord(
      payment({ order_id: 99 }),
      { orderIds: new Set() },
    )).toThrow('Payment 8.order_id references missing Order 99')
  })

  test('summarizes persisted payment states without fabricated comparisons', () => {
    const records = [
      normalizePaymentRecord(payment({ id: 1, amount: 1000, status: 'completed' })),
      normalizePaymentRecord(payment({ id: 2, amount: 2000, status: 'succeeded', refund_amount: 500 })),
      normalizePaymentRecord(payment({ id: 3, amount: 3000, status: 'failed' })),
      normalizePaymentRecord(payment({ id: 4, amount: 4000, status: 'pending' })),
      normalizePaymentRecord(payment({ id: 5, amount: 5000, status: 'refunded', refund_amount: 5000, currency: 'EUR' })),
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
    const record = normalizePaymentRecord(payment({
      id: 1,
      amount: 1000,
      notes: 'Contains, comma',
      billing_email: 'buyer@example.com',
    }))

    const csv = paymentsToCsv([record])
    expect(csv.split('\n')).toHaveLength(2)
    expect(csv).toContain('ID,Created,Status,Method')
    expect(csv).toContain('1,2026-07-29T10:00:00.000Z,completed,creditCard,1000')
  })
})
