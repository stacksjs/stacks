import { describe, expect, test } from 'bun:test'
import {
  buildCommerceDashboard,
  commerceDashboardQueryStart,
  normalizeCommerceDashboardCustomer,
  normalizeCommerceDashboardOrder,
  normalizeCommerceDashboardOrderItem,
  normalizeCommerceDashboardProduct,
  normalizeCommerceDashboardRange,
} from './commerce-dashboard'

const now = new Date('2026-07-29T12:00:00.000Z')

describe('commerce dashboard', () => {
  test('normalizes supported ranges and defaults to 30 days', () => {
    expect(normalizeCommerceDashboardRange('7D')).toBe('7d')
    expect(normalizeCommerceDashboardRange('all')).toBe('all')
    expect(normalizeCommerceDashboardRange('unknown')).toBe('30d')
    expect(commerceDashboardQueryStart('30d', now)?.toISOString()).toBe('2026-05-31T00:00:00.000Z')
    expect(commerceDashboardQueryStart('all', now)).toBeNull()
  })

  test('normalizes model rows without coercing invalid values', () => {
    expect(normalizeCommerceDashboardOrder({
      id: 1,
      status: 'DELIVERED',
      total_amount: '100',
      currency: 'usd',
      customer_id: null,
      created_at: '2026-07-29 10:00:00',
    })).toEqual({
      id: '1',
      status: 'DELIVERED',
      totalAmount: 100,
      currency: 'USD',
      customerId: '',
      createdAt: '2026-07-29T10:00:00.000Z',
    })
    expect(normalizeCommerceDashboardOrderItem({
      id: 2,
      order_id: 1,
      product_id: 4,
      quantity: 2,
      price: 50,
    })).toEqual({
      orderId: '1',
      productId: '4',
      quantity: 2,
      price: 50,
    })
    expect(normalizeCommerceDashboardProduct({ id: 4, name: 'Native Kit' }))
      .toEqual({ id: '4', name: 'Native Kit' })
    expect(normalizeCommerceDashboardCustomer({ id: 9, name: 'Ada Lovelace' }))
      .toEqual({ id: '9', name: 'Ada Lovelace' })
    expect(() => normalizeCommerceDashboardOrder({
      id: 1,
      status: 'DELIVERED',
      total_amount: 'free',
      currency: 'USD',
      created_at: '2026-07-29 10:00:00',
    })).toThrow('Order 1.total_amount must be a finite number')
  })

  test('builds aligned metrics and chart buckets without counting cancelled revenue', () => {
    const result = buildCommerceDashboard(
      [
        { id: '1', status: 'DELIVERED', totalAmount: 100, currency: 'USD', customerId: '9', createdAt: '2026-07-29 10:00:00' },
        { id: '2', status: 'CANCELED', totalAmount: 60, currency: 'USD', customerId: '', createdAt: '2026-07-29 11:00:00' },
        { id: '3', status: 'DELIVERED', totalAmount: 50, currency: 'USD', customerId: '9', createdAt: '2026-07-28 10:00:00' },
      ],
      [
        { orderId: '1', productId: '4', quantity: 2, price: 50 },
        { orderId: '2', productId: '4', quantity: 1, price: 60 },
      ],
      [{ id: '4', name: 'Native Kit' }],
      [{ id: '9', name: 'Ada Lovelace' }],
      'today',
      now,
    )

    expect(result.rangeLabel).toBe('Today')
    expect(result.stats.map(stat => stat.value)).toEqual(['$100.00', '2', '$100.00', '100.0%'])
    expect(result.charts.labels).toHaveLength(13)
    expect(result.charts.orders.reduce((sum, value) => sum + value, 0)).toBe(2)
    expect(result.charts.revenue[0].data.reduce((sum, value) => sum + value, 0)).toBe(100)
    expect(result.topProducts).toEqual([
      { id: '4:USD', name: 'Native Kit', sales: 2, revenue: '$100.00' },
    ])
    expect(result.recentOrders[0]).toEqual({
      id: 'ORD-0002',
      customer: 'Guest',
      total: '$60.00',
      status: 'CANCELED',
      createdAt: '2026-07-29 11:00:00',
    })
  })

  test('keeps currencies separate in revenue, averages, charts, and product totals', () => {
    const result = buildCommerceDashboard(
      [
        { id: '1', status: 'DELIVERED', totalAmount: 100, currency: 'USD', customerId: '', createdAt: '2026-07-29T08:00:00.000Z' },
        { id: '2', status: 'DELIVERED', totalAmount: 80, currency: 'EUR', customerId: '', createdAt: '2026-07-29T09:00:00.000Z' },
      ],
      [
        { orderId: '1', productId: '4', quantity: 2, price: 50 },
        { orderId: '2', productId: '4', quantity: 1, price: 80 },
      ],
      [{ id: '4', name: 'Native Kit' }],
      [],
      'today',
      now,
    )

    expect(result.stats[0].value).toBe('2 currencies')
    expect(result.stats[0].detail).toContain('$100.00')
    expect(result.stats[0].detail).toContain('€80.00')
    expect(result.stats[2].value).toBe('Mixed currencies')
    expect(result.charts.revenue.map(series => series.currency)).toEqual(['EUR', 'USD'])
    expect(result.topProducts).toHaveLength(2)
  })

  test('compares the selected range with the immediately preceding range', () => {
    const result = buildCommerceDashboard(
      [
        { id: '1', status: 'DELIVERED', totalAmount: 200, currency: 'USD', customerId: '', createdAt: '2026-07-28T10:00:00.000Z' },
        { id: '2', status: 'DELIVERED', totalAmount: 100, currency: 'USD', customerId: '', createdAt: '2026-07-20T10:00:00.000Z' },
      ],
      [],
      [],
      [],
      '7d',
      now,
    )

    expect(result.stats[0].change).toBe('+100.0%')
    expect(result.stats[1].change).toBe('0.0%')
  })

  test('rejects missing dashboard relationships instead of inventing labels', () => {
    expect(() => buildCommerceDashboard(
      [{ id: '1', status: 'DELIVERED', totalAmount: 100, currency: 'USD', customerId: '9', createdAt: now.toISOString() }],
      [],
      [],
      [],
      'today',
      now,
    )).toThrow('Order 1.customer_id references missing Customer 9')

    expect(() => buildCommerceDashboard(
      [{ id: '1', status: 'DELIVERED', totalAmount: 100, currency: 'USD', customerId: '', createdAt: now.toISOString() }],
      [{ orderId: '1', productId: '4', quantity: 1, price: 100 }],
      [],
      [],
      'today',
      now,
    )).toThrow('OrderItem.product_id references missing Product 4')
  })
})
