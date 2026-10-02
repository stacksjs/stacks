import { describe, expect, it } from 'bun:test'
import { makeModelRecords } from '@stacksjs/database'
import { faker } from '@stacksjs/faker'
import OrderItem from '../../../../defaults/app/Models/commerce/OrderItem'

/**
 * Seeded commerce data used to be in whole currency units or smaller: an order
 * item priced 5 to 50 (5 to 50 CENTS once #2851 made every amount minor units),
 * a gift card whose balance was always 1, a fixed-amount coupon worth 5 cents.
 * The dashboard then showed a store full of $0.35 line items.
 *
 * These run the seeder's own record generation (`makeModelRecords`, which is
 * what `buddy seed` and `@stacksjs/testing` factories call) and check every
 * money column comes out as an integer number of minor units in a range a real
 * store would hold.
 */

const SAMPLE = 60

type Row = Record<string, unknown>

async function rows(model: string): Promise<Row[]> {
  return makeModelRecords(model, SAMPLE)
}

/**
 * Records for a model the seeder skips (no `useSeeder`), built the way the
 * seeder builds one: every attribute's factory, in declaration order.
 */
function unseededRows(definition: { attributes?: Record<string, { factory?: (f: typeof faker) => unknown }> }): Row[] {
  return Array.from({ length: SAMPLE }, () => Object.fromEntries(
    Object.entries(definition.attributes ?? {})
      .filter(([, attribute]) => typeof attribute.factory === 'function')
      .map(([name, attribute]) => [name.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`), attribute.factory!(faker)]),
  ))
}

/** Each value is null or a whole number of minor units within [min, max]. */
function expectMinorUnits(records: Row[], column: string, min: number, max: number): void {
  for (const record of records) {
    const value = record[column]
    if (value === null || value === undefined)
      continue
    expect({ column, value, integer: Number.isSafeInteger(value) }).toEqual({ column, value, integer: true })
    expect(value as number).toBeGreaterThanOrEqual(min)
    expect(value as number).toBeLessThanOrEqual(max)
  }
}

describe('commerce factories produce integer minor units (stacksjs/stacks#2851)', () => {
  it('prices an order item like a product: $1.00 to $100.00', async () => {
    // OrderItem has no seeder of its own; its factory still feeds tests.
    expectMinorUnits(unseededRows(OrderItem as any), 'price', 100, 10000)
    expectMinorUnits(await rows('Product'), 'price', 100, 10000)
  })

  it('gives orders totals, tax, discounts, fees and tips in cents', async () => {
    const orders = await rows('Order')
    expectMinorUnits(orders, 'total_amount', 1000, 50000)
    expectMinorUnits(orders, 'tax_amount', 0, 4000)
    expectMinorUnits(orders, 'discount_amount', 0, 2000)
    expectMinorUnits(orders, 'delivery_fee', 0, 799)
    expectMinorUnits(orders, 'tip_amount', 0, 1500)
  })

  it('never seeds a gift card holding more than it was issued with', async () => {
    const cards = await rows('GiftCard')
    expectMinorUnits(cards, 'initial_balance', 2500, 25000)
    expectMinorUnits(cards, 'current_balance', 0, 25000)
    for (const card of cards)
      expect(card.current_balance as number).toBeLessThanOrEqual(card.initial_balance as number)
    // Not every card at the same balance, which is what `() => 1` produced.
    expect(new Set(cards.map(card => card.current_balance)).size).toBeGreaterThan(1)
  })

  it('values a coupon by its type: a percentage, or a fixed amount in cents', async () => {
    const coupons = await rows('Coupon')
    const fixed = coupons.filter(coupon => coupon.discount_type === 'fixed_amount')
    const percentage = coupons.filter(coupon => coupon.discount_type === 'percentage')
    expect(fixed.length).toBeGreaterThan(0)
    expect(percentage.length).toBeGreaterThan(0)

    expectMinorUnits(fixed, 'discount_value', 500, 5000)
    expectMinorUnits(percentage, 'discount_value', 5, 50)
    expectMinorUnits(coupons, 'min_order_amount', 0, 10000)
    expectMinorUnits(coupons, 'max_discount_amount', 1000, 10000)
  })

  it('keeps carts, payments, transactions and customers in cents', async () => {
    const carts = await rows('Cart')
    expectMinorUnits(carts, 'subtotal', 1000, 20000)
    expectMinorUnits(carts, 'total', 1000, 21500)

    const cartItems = await rows('CartItem')
    expectMinorUnits(cartItems, 'unit_price', 100, 10000)
    expectMinorUnits(cartItems, 'total_price', 100, 50000)
    for (const item of cartItems)
      expect(item.discount_amount as number).toBeLessThanOrEqual(item.unit_price as number)

    expectMinorUnits(await rows('Payment'), 'amount', 1000, 50000)
    expectMinorUnits(await rows('Transaction'), 'amount', 500, 50000)
    expectMinorUnits(await rows('Customer'), 'total_spent', 0, 500000)
    expectMinorUnits(await rows('ShippingRate'), 'rate', 500, 5000)
  })
})
