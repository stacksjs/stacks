import { describe, expect, test } from 'bun:test'
import { normalizeCouponRecord, summarizeCoupons } from './coupon-records'

function coupon(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 4,
    code: 'SAVE20',
    description: 'Twenty percent off',
    status: 'Active',
    is_active: true,
    discount_type: 'percentage',
    discount_value: 20,
    min_order_amount: null,
    max_discount_amount: null,
    free_product_id: null,
    usage_limit: null,
    usage_count: 0,
    start_date: null,
    end_date: null,
    product_id: null,
    created_at: '2026-06-30 09:00:00',
    ...overrides,
  }
}

describe('dashboard coupon records', () => {
  test('normalizes persisted Coupon model columns and relationships', () => {
    expect(normalizeCouponRecord(coupon({
      is_active: 1,
      discount_value: '20',
      min_order_amount: 50,
      max_discount_amount: 100,
      free_product_id: 'product-1',
      usage_limit: 200,
      usage_count: 27,
      start_date: '2026-07-01',
      end_date: '2026-08-01',
      product_id: 9,
    }), new Set(['9']))).toEqual({
      id: '4',
      code: 'SAVE20',
      description: 'Twenty percent off',
      status: 'Active',
      isActive: true,
      discountType: 'percentage',
      discountValue: 20,
      minOrderAmount: 50,
      maxDiscountAmount: 100,
      freeProductId: 'product-1',
      productId: '9',
      usageLimit: 200,
      usageCount: 27,
      startDate: '2026-07-01',
      endDate: '2026-08-01',
      createdAt: '2026-06-30T09:00:00.000Z',
    })
  })

  test('preserves absent limits and rejects invalid coupon state', () => {
    expect(normalizeCouponRecord(coupon())).toMatchObject({
      minOrderAmount: null,
      maxDiscountAmount: null,
      usageLimit: null,
      productId: '',
    })
    expect(() => normalizeCouponRecord(coupon({
      discount_value: 101,
    }))).toThrow('at most 100 for percentage coupons')
    expect(() => normalizeCouponRecord(coupon({
      product_id: 99,
    }), new Set())).toThrow('Coupon 4.product_id references missing Product 99')
    expect(() => normalizeCouponRecord(coupon({
      start_date: '2026-02-30',
    }))).toThrow('valid YYYY-MM-DD date')
  })

  test('summarizes persisted status and usage fields', () => {
    const records = [
      normalizeCouponRecord(coupon({ id: 1, status: 'Active', is_active: true, usage_count: 3 })),
      normalizeCouponRecord(coupon({ id: 2, status: 'Scheduled', is_active: true, usage_count: 2 })),
      normalizeCouponRecord(coupon({ id: 3, status: 'Expired', is_active: false, usage_count: 8 })),
    ]
    expect(summarizeCoupons(records)).toEqual({
      total: 3,
      enabled: 2,
      scheduled: 1,
      expired: 1,
      redemptions: 13,
    })
  })
})
