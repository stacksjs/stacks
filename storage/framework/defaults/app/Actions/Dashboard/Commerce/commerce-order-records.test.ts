import { describe, expect, test } from 'bun:test'
import {
  addOrderItemQuantity,
  normalizeCommerceOrderRecord,
  normalizeOrderCustomerContext,
  normalizeOrderCustomerOption,
  summarizeCommerceOrders,
} from './commerce-order-records'

function order(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 12,
    customer_id: null,
    status: 'READY',
    total_amount: 90,
    currency: 'EUR',
    tax_amount: 10,
    discount_amount: 5,
    delivery_fee: 4,
    tip_amount: 3,
    order_type: 'DELIVERY',
    delivery_address: null,
    special_instructions: null,
    estimated_delivery_time: null,
    applied_coupon_id: null,
    coupon_id: null,
    created_at: '2026-07-29 12:00:00',
    ...overrides,
  }
}

describe('dashboard commerce order records', () => {
  test('normalizes persisted order fields and joined context', () => {
    const record = normalizeCommerceOrderRecord(
      order({ customer_id: 3, coupon_id: 7, currency: 'eur' }),
      new Map([['3', { name: 'Ada', email: 'ada@example.test' }]]),
      new Map([['12', 4]]),
      new Set(['7']),
    )

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
      deliveryFee: 4,
      tipAmount: 3,
      orderType: 'DELIVERY',
      couponId: '7',
      itemCount: 4,
      createdAt: '2026-07-29T12:00:00.000Z',
    })
  })

  test('rejects corrupt values and missing relationships', () => {
    expect(() => normalizeCommerceOrderRecord(
      order({ total_amount: 'free' }),
      new Map(),
      new Map(),
    )).toThrow('Order 12.total_amount must be a finite number')

    expect(() => normalizeCommerceOrderRecord(
      order({ customer_id: 3 }),
      new Map(),
      new Map(),
    )).toThrow('Order 12.customer_id references missing Customer 3')

    expect(() => normalizeCommerceOrderRecord(
      order({ coupon_id: 7 }),
      new Map(),
      new Map(),
      new Set(),
    )).toThrow('Order 12.coupon_id references missing Coupon 7')
  })

  test('sums validated item quantities instead of line count', () => {
    const orderIds = new Set(['12'])
    const itemCounts = new Map<string, number>()
    addOrderItemQuantity({ id: 1, order_id: 12, quantity: 2 }, orderIds, itemCounts)
    addOrderItemQuantity({ id: 2, order_id: 12, quantity: 3 }, orderIds, itemCounts)
    expect(itemCounts.get('12')).toBe(5)
    expect(() => addOrderItemQuantity(
      { id: 3, order_id: 99, quantity: 1 },
      orderIds,
      itemCounts,
    )).toThrow('OrderItem 3.order_id references missing Order 99')
  })

  test('keeps currencies separate and summarizes persisted states', () => {
    const records = [
      normalizeCommerceOrderRecord(order({ id: 1, status: 'PENDING', total_amount: 10, currency: 'USD' }), new Map(), new Map()),
      normalizeCommerceOrderRecord(order({ id: 2, status: 'READY', total_amount: 20, currency: 'USD' }), new Map(), new Map()),
      normalizeCommerceOrderRecord(order({ id: 3, status: 'paid', total_amount: 30, currency: 'EUR' }), new Map(), new Map()),
      normalizeCommerceOrderRecord(order({ id: 4, status: 'CANCELED', total_amount: 40, currency: 'USD' }), new Map(), new Map()),
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
  })

  test('validates customer option and lookup records', () => {
    expect(normalizeOrderCustomerOption({
      id: 5,
      name: 'Guest customer',
      email: 'guest@example.test',
    })).toEqual({
      id: '5',
      label: 'Guest customer',
    })
    expect(normalizeOrderCustomerContext({
      id: 5,
      name: 'Guest customer',
      email: 'guest@example.test',
    })).toEqual({
      id: '5',
      context: {
        name: 'Guest customer',
        email: 'guest@example.test',
      },
    })
  })
})
