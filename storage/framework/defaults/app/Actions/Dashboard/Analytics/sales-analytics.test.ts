import { describe, expect, test } from 'bun:test'
import { buildSalesAnalytics } from './sales-analytics'

const now = new Date('2026-07-29T12:00:00.000Z')

describe('sales analytics', () => {
  test('keeps currencies separate and uses recorded payment methods', () => {
    const result = buildSalesAnalytics(
      [
        { id: '1', status: 'DELIVERED', totalAmount: 120, currency: 'USD', createdAt: '2026-07-29T10:00:00.000Z' },
        { id: '2', status: 'CANCELED', totalAmount: 50, currency: 'USD', createdAt: '2026-07-29T10:30:00.000Z' },
        { id: '3', status: 'DELIVERED', totalAmount: 80, currency: 'EUR', createdAt: '2026-07-29T11:00:00.000Z' },
      ],
      [
        { method: 'creditCard', status: 'completed', amount: 120, refundAmount: 0, currency: 'USD', createdAt: '2026-07-29T10:00:00.000Z' },
        { method: 'paypal', status: 'refunded', amount: 50, refundAmount: 0, currency: 'USD', createdAt: '2026-07-29T10:30:00.000Z' },
        { method: 'creditCard', status: 'completed', amount: 80, refundAmount: 0, currency: 'EUR', createdAt: '2026-07-29T11:00:00.000Z' },
      ],
      [],
      [],
      [],
      'day',
      now,
    )

    expect(result.currencyTotals).toEqual([
      { currency: 'USD', orders: 2, gross: 170, cancelled: 50, net: 120, average: 85 },
      { currency: 'EUR', orders: 1, gross: 80, cancelled: 0, net: 80, average: 80 },
    ])
    expect(result.paymentMethods.map(method => `${method.method}:${method.currency}`)).toEqual(['Credit Card:EUR', 'Credit Card:USD', 'Paypal:USD'])
    expect(result.paymentMethods.find(method => method.method === 'Paypal')?.refunds).toBe(50)
  })

  test('aggregates recorded order items by product and category', () => {
    const result = buildSalesAnalytics(
      [{ id: '1', status: 'DELIVERED', totalAmount: 75, currency: 'USD', createdAt: '2026-07-29T10:00:00.000Z' }],
      [],
      [
        { orderId: '1', productId: '10', quantity: 2, price: 25 },
        { orderId: '1', productId: '10', quantity: 1, price: 25 },
      ],
      [{ id: '10', name: 'Native Kit', categoryId: '4' }],
      [{ id: '4', name: 'Tools' }],
      'month',
      now,
    )

    expect(result.topProducts).toEqual([{
      id: '10:USD',
      productId: '10',
      name: 'Native Kit',
      categoryId: '4',
      quantity: 3,
      revenue: 75,
      currency: 'USD',
    }])
    expect(result.categories).toEqual([{
      id: '4:USD',
      categoryId: '4',
      name: 'Tools',
      quantity: 3,
      revenue: 75,
      currency: 'USD',
    }])
  })
})
