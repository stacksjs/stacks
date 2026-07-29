import { describe, expect, test } from 'bun:test'
import { normalizeCouponRecord, summarizeCoupons } from './coupon-records'

describe('dashboard coupon records', () => {
  test('normalizes persisted Coupon model columns', () => {
    expect(normalizeCouponRecord({
      id: 4,
      code: 'SAVE20',
      description: 'Twenty percent off',
      status: 'Active',
      is_active: 1,
      discount_type: 'percentage',
      discount_value: '20',
      min_order_amount: 50,
      max_discount_amount: 100,
      free_product_id: 'product-1',
      usage_limit: 200,
      usage_count: 27,
      start_date: '2026-07-01',
      end_date: '2026-08-01',
      created_at: '2026-06-30 09:00:00',
    })).toEqual({
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
      usageLimit: 200,
      usageCount: 27,
      startDate: '2026-07-01',
      endDate: '2026-08-01',
      createdAt: '2026-06-30 09:00:00',
    })
  })

  test('summarizes persisted status and usage fields', () => {
    const base = {
      id: '',
      code: '',
      description: '',
      discountType: 'fixed_amount' as const,
      discountValue: 10,
      minOrderAmount: 0,
      maxDiscountAmount: 0,
      freeProductId: '',
      usageLimit: 10,
      startDate: '',
      endDate: '',
      createdAt: '',
    }
    expect(summarizeCoupons([
      { ...base, id: '1', status: 'Active', isActive: true, usageCount: 3 },
      { ...base, id: '2', status: 'Scheduled', isActive: true, usageCount: 2 },
      { ...base, id: '3', status: 'Expired', isActive: false, usageCount: 8 },
    ])).toEqual({
      total: 3,
      enabled: 2,
      scheduled: 1,
      expired: 1,
      redemptions: 13,
    })
  })
})
