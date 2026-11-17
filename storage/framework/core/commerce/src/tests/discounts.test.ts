import { beforeEach, describe, expect, it } from 'bun:test'
import { db } from '@stacksjs/database'
import { deactivate, fetchRules, price, redeemApplied, ruleFromCoupon, store } from '../discounts'
import { refreshDatabase } from './setup'

/**
 * Discounts as stored rows: what the checkout loads, how the engine prices
 * with them, and the atomic use count afterwards.
 */

beforeEach(async () => {
  await refreshDatabase()
})

const NOW = new Date('2026-11-16T12:00:00Z')

describe('stored discounts', () => {
  it('applies an automatic buy X get Y with no code entered', async () => {
    const discount = await store({ title: 'BUY 4, GET 4 FREE | 50% OFF', type: 'buy_x_get_y', buyQuantity: 4, getQuantity: 4, getPercent: 100, target: { productIds: [7] } })
    expect(discount.code).toBeNull()

    const priced = await price({ lines: [{ id: 1, productId: 7, quantity: 8, unitPrice: 2500 }], now: NOW })
    expect(priced.discount).toBe(10000)
    expect(priced.applied).toEqual([{ ruleId: `discount:${discount.id}`, title: 'BUY 4, GET 4 FREE | 50% OFF', code: null, class: 'product', amount: 10000 }])
  })

  it('loads a coded discount only when its code is entered, in any case', async () => {
    await store({ title: 'Welcome', code: 'WELCOME10', type: 'percentage', value: 10 })
    const line = { id: 1, productId: 1, quantity: 1, unitPrice: 5000 }
    expect((await price({ lines: [line], now: NOW })).discount).toBe(0)
    expect((await price({ lines: [line], codes: ['welcome10'], now: NOW })).discount).toBe(500)
  })

  it('stores volume tiers and free shipping that combine', async () => {
    await store({ title: 'Stock up', type: 'volume', tiers: [{ minQuantity: 5, percent: 20 }], target: { productIds: [1] }, combinesWith: { shipping: true } })
    await store({ title: 'Free shipping', type: 'free_shipping', minimumSubtotal: 4000, combinesWith: { product: true } })
    const priced = await price({ lines: [{ id: 1, productId: 1, quantity: 5, unitPrice: 1000 }], shipping: 500, now: NOW })
    expect(priced.productDiscount).toBe(1000)
    expect(priced.shippingDiscount).toBe(500)
    expect(priced.total).toBe(4000)
  })

  it('leaves out a switched-off automatic discount', async () => {
    const discount = await store({ title: '10% off', type: 'percentage', value: 10 })
    expect(await deactivate(discount.id)).toBe(true)
    expect(await fetchRules()).toEqual([])
  })

  it('refuses a discount that could not price a basket', async () => {
    await expect(store({ title: 'Broken', type: 'percentage', value: 150 })).rejects.toThrow(TypeError)
    await expect(store({ title: 'Broken', type: 'volume', tiers: [] })).rejects.toThrow(TypeError)
  })

  it('counts uses atomically and stops at the limit', async () => {
    const discount = await store({ title: 'First two', code: 'TWO', type: 'percentage', value: 10, usageLimit: 2 })
    const applied = [{ ruleId: `discount:${discount.id}` }]
    expect(await redeemApplied(applied)).toEqual([{ ruleId: `discount:${discount.id}`, ok: true }])
    expect(await redeemApplied(applied)).toEqual([{ ruleId: `discount:${discount.id}`, ok: true }])
    expect(await redeemApplied(applied)).toEqual([{ ruleId: `discount:${discount.id}`, ok: false, reason: 'limit-reached' }])

    const priced = await price({ lines: [{ id: 1, productId: 1, quantity: 1, unitPrice: 1000 }], codes: ['TWO'], now: NOW })
    expect(priced.rejectedCodes).toEqual([{ code: 'TWO', reason: 'exhausted' }])
  })
})

describe('coupons through the engine', () => {
  it('prices an existing coupon by its code', async () => {
    await db.insertInto('coupons' as any).values({ code: 'SAVE5', discount_type: 'fixed_amount', discount_value: 500, is_active: true, usage_count: 0, start_date: '2026-01-01', end_date: '2026-12-31' } as any).execute()
    const priced = await price({ lines: [{ id: 1, productId: 1, quantity: 2, unitPrice: 1500 }], codes: ['save5'], now: NOW })
    expect(priced.orderDiscount).toBe(500)
    expect(String(priced.applied[0]!.ruleId)).toStartWith('coupon:')
  })

  it('keeps a coupon valid through its whole end date and maps a free product', () => {
    const rule = ruleFromCoupon({ id: 1, code: 'FREEBOWL', discount_type: 'percentage', discount_value: 0, free_product_id: '9', end_date: '2026-11-16' })
    expect(rule.endsAt).toBe('2026-11-16T23:59:59.999Z')
    expect(rule.effect).toMatchObject({ type: 'buy_x_get_y', getTarget: { productIds: [9] }, getPercent: 100, maxApplications: 1 })
  })
})
