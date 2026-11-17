/**
 * The discount engine against the deals storefronts actually run. Pure: no
 * database, no clock except the one passed in.
 */
import type { DiscountLineInput, DiscountRule } from '../src/discounts/engine'
import { describe, expect, it } from 'bun:test'
import { allocate, applyDiscounts, canCombine, discountClass, discountLabel, isDiscountAvailable, matchesTarget } from '../src/discounts/engine'

const NOW = new Date('2026-11-16T12:00:00Z')
const line = (id: number, productId: number, quantity: number, unitPrice: number, extra: Partial<DiscountLineInput> = {}): DiscountLineInput =>
  ({ id, productId, quantity, unitPrice, ...extra })

describe('buy X get Y', () => {
  const toeSocks: DiscountRule = {
    id: 'b4g4',
    title: 'BUY 4, GET 4 FREE | 50% OFF',
    effect: { type: 'buy_x_get_y', buyQuantity: 4, getQuantity: 4, getPercent: 100 },
    target: { productIds: [7] },
  }

  it('prices eight pairs of toe socks at half, as an automatic discount', () => {
    const result = applyDiscounts({ lines: [line(1, 7, 8, 2500, { compareAtPrice: 2500 })], rules: [toeSocks], now: NOW })
    expect(result.subtotal).toBe(20000)
    expect(result.productDiscount).toBe(10000)
    expect(result.total).toBe(10000)
    expect(result.totalSavings).toBe(10000)
    expect(result.applied).toEqual([{ ruleId: 'b4g4', title: 'BUY 4, GET 4 FREE | 50% OFF', code: null, class: 'product', amount: 10000 }])
    expect(result.lines[0]!.allocations).toEqual([{ ruleId: 'b4g4', amount: 10000 }])
  })

  it('needs the full "buy" quantity before anything is free', () => {
    const result = applyDiscounts({ lines: [line(1, 7, 4, 2500)], rules: [toeSocks], now: NOW })
    expect(result.discount).toBe(0)
    expect(result.applied).toEqual([])
  })

  it('discounts the "get" units there are when fewer than promised are in the cart', () => {
    const result = applyDiscounts({ lines: [line(1, 7, 6, 2500)], rules: [toeSocks], now: NOW })
    expect(result.discount).toBe(5000)
  })

  it('discounts the cheapest units, not the dearest', () => {
    const rule: DiscountRule = { id: 1, title: 'B2G1', effect: { type: 'buy_x_get_y', buyQuantity: 2, getQuantity: 1, getPercent: 100 } }
    const result = applyDiscounts({ lines: [line(1, 1, 2, 3000), line(2, 2, 1, 1000)], rules: [rule], now: NOW })
    expect(result.discount).toBe(1000)
    expect(result.lines[1]!.discount).toBe(1000)
    expect(result.lines[0]!.discount).toBe(0)
  })

  it('repeats per order up to maxApplications', () => {
    const rule: DiscountRule = { id: 1, title: 'B1G1 half', effect: { type: 'buy_x_get_y', buyQuantity: 1, getQuantity: 1, getPercent: 50, maxApplications: 2 } }
    const result = applyDiscounts({ lines: [line(1, 1, 10, 1000)], rules: [rule], now: NOW })
    expect(result.discount).toBe(1000)
  })

  it('keeps what must be bought apart from what comes free', () => {
    const rule: DiscountRule = {
      id: 1,
      title: 'Buy a bowl, get a scoop free',
      effect: { type: 'buy_x_get_y', buyQuantity: 1, buyTarget: { productIds: [1] }, getQuantity: 1, getTarget: { productIds: [2] }, getPercent: 100 },
    }
    expect(applyDiscounts({ lines: [line(1, 2, 3, 500)], rules: [rule], now: NOW }).discount).toBe(0)
    const result = applyDiscounts({ lines: [line(1, 1, 1, 4000), line(2, 2, 3, 500)], rules: [rule], now: NOW })
    expect(result.discount).toBe(500)
    expect(result.lines[1]!.discount).toBe(500)
  })
})

describe('volume tiers', () => {
  const tiers: DiscountRule = {
    id: 'vol',
    title: 'Stock up',
    effect: { type: 'volume', tiers: [{ minQuantity: 5, percent: 20 }, { minQuantity: 10, percent: 30 }] },
    target: { categoryIds: [3] },
  }

  it('applies the highest tier the targeted quantity reaches, across lines', () => {
    const lines = [line(1, 1, 3, 1000, { categoryId: 3 }), line(2, 2, 3, 1000, { categoryId: 3 }), line(3, 9, 5, 1000)]
    const result = applyDiscounts({ lines, rules: [tiers], now: NOW })
    expect(result.productDiscount).toBe(1200)
    expect(result.lines[2]!.discount).toBe(0)

    const more = applyDiscounts({ lines: [line(1, 1, 10, 1000, { categoryId: 3 })], rules: [tiers], now: NOW })
    expect(more.discount).toBe(3000)
  })

  it('gives nothing below the first tier', () => {
    expect(applyDiscounts({ lines: [line(1, 1, 4, 1000, { categoryId: 3 })], rules: [tiers], now: NOW }).discount).toBe(0)
  })
})

describe('amount off products and orders', () => {
  it('takes a percentage off only the targeted lines', () => {
    const rule: DiscountRule = { id: 1, title: '25% off tees', effect: { type: 'percentage', percent: 25 }, target: { variantIds: [11] } }
    const result = applyDiscounts({ lines: [line(1, 1, 2, 2000, { variantId: 11 }), line(2, 1, 1, 2000, { variantId: 12 })], rules: [rule], now: NOW })
    expect(result.productDiscount).toBe(1000)
    expect(result.lines.map(l => l.discount)).toEqual([1000, 0])
  })

  it('takes a fixed amount per item, or once across the targeted lines', () => {
    const each: DiscountRule = { id: 1, title: '$2 off each', effect: { type: 'fixed_amount', amount: 200, perItem: true }, target: { productIds: [1] } }
    expect(applyDiscounts({ lines: [line(1, 1, 3, 1000)], rules: [each], now: NOW }).discount).toBe(600)

    const once: DiscountRule = { id: 2, title: '$5 off', effect: { type: 'fixed_amount', amount: 500 }, target: { productIds: [1, 2] } }
    const result = applyDiscounts({ lines: [line(1, 1, 1, 1000), line(2, 2, 1, 3000)], rules: [once], now: NOW })
    expect(result.discount).toBe(500)
    expect(result.lines.map(l => l.discount)).toEqual([125, 375])
  })

  it('spreads an order discount across every line to the minor unit', () => {
    const rule: DiscountRule = { id: 1, title: '10% off', effect: { type: 'percentage', percent: 10 } }
    expect(discountClass(rule)).toBe('order')
    const result = applyDiscounts({ lines: [line(1, 1, 1, 333), line(2, 2, 1, 333), line(3, 3, 1, 334)], rules: [rule], now: NOW })
    expect(result.orderDiscount).toBe(100)
    expect(result.lines.reduce((s, l) => s + l.discount, 0)).toBe(100)
  })

  it('never takes a fixed order discount past the basket', () => {
    const rule: DiscountRule = { id: 1, title: '$50 off', effect: { type: 'fixed_amount', amount: 5000 } }
    const result = applyDiscounts({ lines: [line(1, 1, 1, 1200)], rules: [rule], now: NOW })
    expect(result.discount).toBe(1200)
    expect(result.total).toBe(0)
  })

  it('caps a discount at maxAmount', () => {
    const rule: DiscountRule = { id: 1, title: '50% off up to $10', effect: { type: 'percentage', percent: 50 }, maxAmount: 1000 }
    expect(applyDiscounts({ lines: [line(1, 1, 1, 5000)], rules: [rule], now: NOW }).discount).toBe(1000)
  })

  it('holds a product discount to a minimum on its own targeted lines', () => {
    const rule: DiscountRule = { id: 1, title: '10% off socks over $50', code: 'SOCKS', effect: { type: 'percentage', percent: 10 }, target: { productIds: [1] }, minimumSubtotal: 5000 }
    const result = applyDiscounts({ lines: [line(1, 1, 1, 2000), line(2, 2, 1, 9000)], rules: [rule], codes: ['socks'], now: NOW })
    expect(result.discount).toBe(0)
    expect(result.rejectedCodes).toEqual([{ code: 'SOCKS', reason: 'requirements-not-met' }])
  })
})

describe('free shipping', () => {
  const free: DiscountRule = { id: 'ship', title: 'Free shipping over $40', effect: { type: 'free_shipping' }, minimumSubtotal: 4000, combinesWith: { product: true, order: true } }

  it('waives shipping once the basket clears the minimum', () => {
    expect(applyDiscounts({ lines: [line(1, 1, 1, 3000)], rules: [free], shipping: 500, now: NOW }).shippingAfterDiscount).toBe(500)
    const result = applyDiscounts({ lines: [line(1, 1, 2, 3000)], rules: [free], shipping: 500, now: NOW })
    expect(result.shippingDiscount).toBe(500)
    expect(result.total).toBe(6000)
    expect(result.totalSavings).toBe(500)
  })

  it('skips rates above its ceiling', () => {
    const capped: DiscountRule = { id: 1, title: 'Free standard shipping', effect: { type: 'free_shipping', maxShipping: 800 } }
    expect(applyDiscounts({ lines: [line(1, 1, 1, 1000)], rules: [capped], shipping: 1500, now: NOW }).shippingDiscount).toBe(0)
    expect(applyDiscounts({ lines: [line(1, 1, 1, 1000)], rules: [capped], shipping: 700, now: NOW }).shippingDiscount).toBe(700)
  })
})

describe('combining', () => {
  const tenOff: DiscountRule = { id: 'ten', title: '10% off', effect: { type: 'percentage', percent: 10 } }
  const twenty: DiscountRule = { id: 'twenty', title: '20% off', code: 'TWENTY', effect: { type: 'percentage', percent: 20 } }

  it('applies only the better of two discounts that do not combine, and says why the code lost', () => {
    const result = applyDiscounts({ lines: [line(1, 1, 1, 10000)], rules: [tenOff, twenty], codes: ['TWENTY'], now: NOW })
    expect(result.applied.map(a => a.ruleId)).toEqual(['twenty'])
    expect(result.discount).toBe(2000)

    const weak: DiscountRule = { ...twenty, effect: { type: 'percentage', percent: 5 } }
    const lost = applyDiscounts({ lines: [line(1, 1, 1, 10000)], rules: [tenOff, weak], codes: ['twenty'], now: NOW })
    expect(lost.applied.map(a => a.ruleId)).toEqual(['ten'])
    expect(lost.rejectedCodes).toEqual([{ code: 'TWENTY', reason: 'not-combinable' }])
  })

  it('takes an order discount off what is left after a product discount, when both combine', () => {
    const product: DiscountRule = { id: 'p', title: '50% off socks', effect: { type: 'percentage', percent: 50 }, target: { productIds: [1] }, combinesWith: { order: true } }
    const order: DiscountRule = { id: 'o', title: '10% off', effect: { type: 'percentage', percent: 10 }, combinesWith: { product: true } }
    expect(canCombine(product, order)).toBe(true)
    const result = applyDiscounts({ lines: [line(1, 1, 2, 1000), line(2, 2, 1, 1000)], rules: [order, product], now: NOW })
    expect(result.productDiscount).toBe(1000)
    expect(result.orderDiscount).toBe(200)
    expect(result.total).toBe(1800)
  })

  it('gives a line at most one product discount even when both combine', () => {
    const a: DiscountRule = { id: 'a', title: '30%', effect: { type: 'percentage', percent: 30 }, target: { productIds: [1] }, combinesWith: { product: true } }
    const b: DiscountRule = { id: 'b', title: '20%', effect: { type: 'percentage', percent: 20 }, target: { productIds: [1, 2] }, combinesWith: { product: true } }
    const result = applyDiscounts({ lines: [line(1, 1, 1, 1000), line(2, 2, 1, 1000)], rules: [b, a], now: NOW })
    expect(result.lines.map(l => l.discount)).toEqual([300, 200])
    expect(result.lines[0]!.allocations.map(x => x.ruleId)).toEqual(['a'])
  })

  it('needs both sides to agree', () => {
    const product: DiscountRule = { id: 'p', title: 'p', effect: { type: 'percentage', percent: 10 }, target: { productIds: [1] }, combinesWith: { order: true } }
    const order: DiscountRule = { id: 'o', title: 'o', effect: { type: 'percentage', percent: 10 } }
    expect(canCombine(product, order)).toBe(false)
  })
})

describe('codes and availability', () => {
  const rule: DiscountRule = { id: 1, title: 'Welcome', code: 'Welcome10', effect: { type: 'percentage', percent: 10 } }

  it('matches codes regardless of case and spacing, once', () => {
    const result = applyDiscounts({ lines: [line(1, 1, 1, 1000)], rules: [rule], codes: [' welcome10 ', 'WELCOME10'], now: NOW })
    expect(result.discount).toBe(100)
    expect(result.applied[0]!.code).toBe('Welcome10')
  })

  it('reports unknown, expired, not yet started and used-up codes', () => {
    const rules: DiscountRule[] = [
      { ...rule, id: 2, code: 'OLD', endsAt: '2026-01-01' },
      { ...rule, id: 3, code: 'SOON', startsAt: '2027-01-01T00:00:00Z' },
      { ...rule, id: 4, code: 'GONE', usageLimit: 10, usageCount: 10 },
      { ...rule, id: 5, code: 'OFF', isActive: false },
    ]
    const result = applyDiscounts({ lines: [line(1, 1, 1, 1000)], rules, codes: ['nope', 'old', 'soon', 'gone', 'off'], now: NOW })
    expect(result.rejectedCodes).toEqual([
      { code: 'nope', reason: 'not-found' },
      { code: 'old', reason: 'expired' },
      { code: 'soon', reason: 'inactive' },
      { code: 'gone', reason: 'exhausted' },
      { code: 'off', reason: 'inactive' },
    ])
    expect(result.discount).toBe(0)
  })

  it('never applies a code-only discount nobody entered', () => {
    expect(applyDiscounts({ lines: [line(1, 1, 1, 1000)], rules: [rule], now: NOW }).discount).toBe(0)
  })

  it('knows availability by date', () => {
    expect(isDiscountAvailable({ ...rule, startsAt: '2026-11-17' }, NOW)).toBe(false)
    expect(isDiscountAvailable({ ...rule, endsAt: '2026-11-17' }, NOW)).toBe(true)
  })
})

describe('savings and helpers', () => {
  it('counts compare-at prices toward what the shopper saved', () => {
    const rule: DiscountRule = { id: 1, title: '60% off', effect: { type: 'percentage', percent: 60 }, target: { productIds: [1] } }
    const result = applyDiscounts({ lines: [line(1, 1, 5, 2000, { compareAtPrice: 2400 })], rules: [rule], now: NOW })
    expect(result.compareAtSavings).toBe(2000)
    expect(result.discount).toBe(6000)
    expect(result.totalSavings).toBe(8000)
    expect(result.lines[0]!.compareAtSubtotal).toBe(12000)
  })

  it('splits an amount exactly and never past a weight', () => {
    expect(allocate(100, [1, 1, 1])).toEqual([1, 1, 1])
    expect(allocate(10, [3, 3, 3])).toEqual([3, 3, 3])
    expect(allocate(7, [1, 2, 4]).reduce((s, n) => s + n, 0)).toBe(7)
    expect(allocate(0, [5, 5])).toEqual([0, 0])
  })

  it('labels discounts the way a storefront badge reads', () => {
    expect(discountLabel({ effect: { type: 'buy_x_get_y', buyQuantity: 4, getQuantity: 4, getPercent: 100 } })).toBe('BUY 4, GET 4 FREE')
    expect(discountLabel({ effect: { type: 'buy_x_get_y', buyQuantity: 2, getQuantity: 1, getPercent: 50 } })).toBe('BUY 2, GET 1 50% OFF')
    expect(discountLabel({ effect: { type: 'percentage', percent: 12.5 } })).toBe('12.5% OFF')
    expect(discountLabel({ effect: { type: 'fixed_amount', amount: 500, perItem: true } }, m => `$${m / 100}`)).toBe('$5 OFF EACH')
    expect(discountLabel({ effect: { type: 'volume', tiers: [{ minQuantity: 10, percent: 30 }, { minQuantity: 5, percent: 20 }] } })).toBe('5+ FOR 20% OFF, 10+ FOR 30% OFF')
    expect(discountLabel({ effect: { type: 'free_shipping' } })).toBe('FREE SHIPPING')
  })

  it('matches targets by product, variant or category', () => {
    expect(matchesTarget({ productId: 1 }, null)).toBe(true)
    expect(matchesTarget({ productId: 1, variantId: 4 }, { variantIds: [4] })).toBe(true)
    expect(matchesTarget({ productId: 1, categoryId: 2 }, { categoryIds: [3] })).toBe(false)
  })

  it('refuses floats and nonsense rather than mispricing', () => {
    expect(() => applyDiscounts({ lines: [line(1, 1, 1, 19.99)], rules: [], now: NOW })).toThrow(TypeError)
    expect(() => applyDiscounts({ lines: [line(1, 1, 0, 100)], rules: [], now: NOW })).toThrow(TypeError)
    expect(() => applyDiscounts({ lines: [], rules: [{ id: 1, title: 'x', effect: { type: 'percentage', percent: 120 } }], now: NOW })).toThrow(TypeError)
    expect(() => applyDiscounts({ lines: [], rules: [{ id: 1, title: 'x', effect: { type: 'buy_x_get_y', buyQuantity: 0, getQuantity: 1, getPercent: 100 } }], now: NOW })).toThrow(TypeError)
  })
})
