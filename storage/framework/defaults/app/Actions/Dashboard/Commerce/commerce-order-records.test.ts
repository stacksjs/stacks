import { describe, expect, test } from 'bun:test'
import {
  normalizeCommerceOrderRecord,
  normalizeOrderCustomerOption,
  summarizeCommerceOrders,
} from './commerce-order-records'

describe('dashboard commerce order records', () => {
  test('normalizes persisted order fields and joined context', () => {
    const record = normalizeCommerceOrderRecord({
      id: 12,
      customer_id: 3,
      status: 'READY',
      total_amount: 90,
      currency: 'eur',
      tax_amount: 10,
      discount_amount: 5,
      order_type: 'DELIVERY',
      created_at: '2026-07-29 12:00:00',
    }, new Map([['3', { name: 'Ada', email: 'ada@example.test' }]]), new Map([['12', 4]]))

    expect(record).toMatchObject({
      id: '12',
      customerId: '3',
      customerName: 'Ada',
      customerEmail: 'ada@example.test',
      status: 'READY',
      totalAmount: 90,
      currency: 'EUR',
      taxAmount: 10,
      discountAmount: 5,
      orderType: 'DELIVERY',
      itemCount: 4,
    })
  })

  test('keeps currencies separate and summarizes persisted states', () => {
    const records = [
      normalizeCommerceOrderRecord({ id: 1, status: 'PENDING', totalAmount: 10, currency: 'USD' }, new Map(), new Map()),
      normalizeCommerceOrderRecord({ id: 2, status: 'READY', totalAmount: 20, currency: 'USD' }, new Map(), new Map()),
      normalizeCommerceOrderRecord({ id: 3, status: 'paid', totalAmount: 30, currency: 'EUR' }, new Map(), new Map()),
      normalizeCommerceOrderRecord({ id: 4, status: 'CANCELED', totalAmount: 40, currency: 'USD' }, new Map(), new Map()),
    ]

    expect(summarizeCommerceOrders(records)).toEqual({
      total: 4,
      pending: 1,
      inProgress: 1,
      completed: 1,
      cancelled: 1,
      currencyTotals: [
        { currency: 'EUR', amount: 30 },
        { currency: 'USD', amount: 70 },
      ],
    })
    expect(normalizeOrderCustomerOption({ id: 5, email: 'guest@example.test' })).toEqual({
      id: '5',
      label: 'guest@example.test',
    })
  })
})
