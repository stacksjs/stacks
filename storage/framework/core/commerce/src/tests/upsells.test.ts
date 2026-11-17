import type { UpsellChargeRequest, UpsellChargeResult } from '../upsells'
import { beforeEach, describe, expect, it } from 'bun:test'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { handleCommercePaymentEvent } from '../orders/webhook'
import { acceptOffer, completeUpsellPayment, declineOffer, eligibleOffers, offerStats, presentOffers, releaseStalePending } from '../upsells'
import { refreshDatabase } from './setup'

/**
 * Post-purchase upsells against real rows: the thank-you page offer from a
 * sock shop ("grab 5+ pairs and get 60% off"), taken with one click and added
 * to the order that was just paid for.
 */

beforeEach(async () => {
  await refreshDatabase()
})

const PLACED = new Date('2026-11-16T12:00:00Z')
const SOON = new Date('2026-11-16T12:05:00Z')

async function insert(table: string, values: Record<string, unknown>): Promise<number> {
  await db.insertInto(table as any).values(values as any).execute()
  const row = await db.selectFrom(table as any).select(['id']).orderBy('id', 'desc').limit(1).executeTakeFirst() as { id: number }
  return Number(row.id)
}

async function row(table: string, id: number): Promise<any> {
  return await db.selectFrom(table as any).where('id', '=', id).selectAll().executeTakeFirst()
}

async function seed(overrides: { offer?: Record<string, unknown>, crewStock?: number | null } = {}) {
  const toeSocks = await insert('products', { name: 'Toe Socks', slug: 'toe-socks', price: 2500, is_available: true, inventory_count: 100, preparation_time: 1 })
  const crew = await insert('products', { name: 'Crew Socks', slug: 'crew-socks', price: 2400, is_available: true, inventory_count: 100, preparation_time: 1 })
  const ankle = await insert('products', { name: 'Ankle Socks', slug: 'ankle-socks', price: 2100, is_available: true, inventory_count: 3, preparation_time: 1 })
  const crewBlackXl = await insert('product_variants', { product_id: crew, variant: 'Black / XL', type: 'Size', options: JSON.stringify({ colour: 'Black', size: 'XL' }), status: 'active', price: null, inventory_count: overrides.crewStock === undefined ? 50 : overrides.crewStock })
  const crewWhiteM = await insert('product_variants', { product_id: crew, variant: 'White / M', type: 'Size', status: 'active', price: 2600, inventory_count: 50 })

  const customer = await insert('customers', { name: 'Chris', email: 'chris@example.com', phone: '555-0100', status: 'Active', avatar: '' })
  const order = await insert('orders', { status: 'PROCESSING', total_amount: 10000, tax_amount: 0, currency: 'USD', order_type: 'shipping', customer_id: customer, created_at: formatDate(PLACED) })
  await insert('order_items', { order_id: order, product_id: toeSocks, quantity: 8, price: 1250 })

  const offer = await insert('post_purchase_offers', {
    name: 'Sock bundle',
    headline: 'One-time offer',
    message: 'Grab 5+ pairs and get 60% off!',
    product_ids: JSON.stringify([crew, ankle]),
    discount_percent: 60,
    min_quantity: 5,
    default_quantity: 5,
    trigger_product_ids: JSON.stringify([toeSocks]),
    window_minutes: 30,
    priority: 1,
    is_active: true,
    ...overrides.offer,
  })
  return { toeSocks, crew, ankle, crewBlackXl, crewWhiteM, customer, order, offer }
}

function charger(result: Partial<UpsellChargeResult> & Pick<UpsellChargeResult, 'status'>, seen: UpsellChargeRequest[] = []) {
  return async (request: UpsellChargeRequest): Promise<UpsellChargeResult> => {
    seen.push(request)
    return { reference: `pi_${seen.length}`, provider: 'stripe', ...result }
  }
}

describe('presenting offers', () => {
  it('shows the qualifying offer priced at its discount, with variants and stock', async () => {
    const s = await seed()
    const [view] = await presentOffers(s.order, { now: SOON })
    expect(view!.offerId).toBe(s.offer)
    expect(view!.message).toBe('Grab 5+ pairs and get 60% off!')
    expect(view!.minQuantity).toBe(5)
    expect(view!.expiresAt).toBe('2026-11-16T12:30:00.000Z')

    const crew = view!.products.find(p => p.productId === s.crew)!
    expect(crew.regularPrice).toBe(2400)
    expect(crew.unitPrice).toBe(960)
    expect(crew.variants.map(v => [v.name, v.unitPrice, v.regularPrice])).toEqual([['Black / XL', 960, 2400], ['White / M', 1040, 2600]])
    expect(crew.variants[0]!.options).toEqual({ colour: 'Black', size: 'XL' })

    const ankle = view!.products.find(p => p.productId === s.ankle)!
    expect(ankle.unitPrice).toBe(840)
    expect(ankle.inventory).toBe(3)
  })

  it('records one view per product, however often the page is opened', async () => {
    const s = await seed()
    await presentOffers(s.order, { now: SOON })
    await presentOffers(s.order, { now: SOON })
    expect((await offerStats(s.offer)).views).toBe(2)
  })

  it('shows nothing once the window closes, to closed orders, or without the trigger product', async () => {
    const s = await seed()
    expect(await eligibleOffers(s.order, { now: new Date('2026-11-16T12:31:00Z') })).toEqual([])

    await db.updateTable('orders' as any).set({ status: 'CANCELLED' } as any).where('id', '=', s.order).execute()
    expect(await eligibleOffers(s.order, { now: SOON })).toEqual([])

    await refreshDatabase()
    const other = await seed({ offer: { trigger_product_ids: JSON.stringify([999]) } })
    expect(await eligibleOffers(other.order, { now: SOON })).toEqual([])
  })

  it('respects a minimum order total and the offer dates', async () => {
    const big = await seed({ offer: { min_order_total: 20000 } })
    expect(await eligibleOffers(big.order, { now: SOON })).toEqual([])
    await refreshDatabase()
    const later = await seed({ offer: { starts_at: '2026-12-01 00:00:00' } })
    expect(await eligibleOffers(later.order, { now: SOON })).toEqual([])
  })
})

describe('accepting an offer', () => {
  it('adds the line to the order, charges the saved card and takes the stock', async () => {
    const s = await seed()
    await presentOffers(s.order, { now: SOON })
    const seen: UpsellChargeRequest[] = []
    const result = await acceptOffer({ orderId: s.order, offerId: s.offer, productId: s.crew, variantId: s.crewBlackXl, quantity: 5, charge: charger({ status: 'succeeded' }, seen), now: SOON })

    expect(result.ok).toBe(true)
    if (!result.ok || result.status !== 'accepted')
      throw new Error('expected accepted')
    expect(seen).toHaveLength(1)
    expect(seen[0]!.amount).toBe(4800)
    expect(seen[0]!.currency).toBe('USD')
    expect(seen[0]!.reference).toBe(`upsell-${result.response.id}`)

    const order = await row('orders', s.order)
    expect(Number(order.total_amount)).toBe(14800)
    const item = await row('order_items', result.orderItemId)
    expect([Number(item.product_id), Number(item.quantity), Number(item.price)]).toEqual([s.crew, 5, 960])
    expect(Number((await row('product_variants', s.crewBlackXl)).inventory_count)).toBe(45)

    const payment = await db.selectFrom('payments' as any).where('transaction_id', '=', 'pi_1').selectAll().executeTakeFirst() as any
    expect(Number(payment.amount)).toBe(4800)
    expect(Number(payment.order_id)).toBe(s.order)
    expect(result.response.status).toBe('accepted')
    expect(Number(result.response.compare_at_price)).toBe(2400)
  })

  it('is one-time: a second acceptance of the same product is refused and charges nothing', async () => {
    const s = await seed()
    const seen: UpsellChargeRequest[] = []
    await acceptOffer({ orderId: s.order, offerId: s.offer, productId: s.crew, variantId: s.crewBlackXl, quantity: 5, charge: charger({ status: 'succeeded' }, seen), now: SOON })
    const again = await acceptOffer({ orderId: s.order, offerId: s.offer, productId: s.crew, variantId: s.crewBlackXl, quantity: 5, charge: charger({ status: 'succeeded' }, seen), now: SOON })
    expect(again).toMatchObject({ ok: false, reason: 'already-responded' })
    expect(seen).toHaveLength(1)
    expect(Number((await row('orders', s.order)).total_amount)).toBe(14800)
  })

  it('lets exactly one of two racing clicks through', async () => {
    const s = await seed()
    const seen: UpsellChargeRequest[] = []
    const results = await Promise.all([1, 2].map(() =>
      acceptOffer({ orderId: s.order, offerId: s.offer, productId: s.crew, variantId: s.crewBlackXl, quantity: 5, charge: charger({ status: 'succeeded' }, seen), now: SOON }),
    ))
    expect(results.filter(r => r.ok)).toHaveLength(1)
    expect(seen).toHaveLength(1)
  })

  it('takes another product of the same offer separately', async () => {
    const s = await seed()
    await acceptOffer({ orderId: s.order, offerId: s.offer, productId: s.crew, variantId: s.crewWhiteM, quantity: 5, charge: 'collect-later', now: SOON })
    const ankle = await acceptOffer({ orderId: s.order, offerId: s.offer, productId: s.ankle, quantity: 5, charge: 'collect-later', now: SOON })
    // Only three ankle pairs left.
    expect(ankle).toMatchObject({ ok: false, reason: 'out-of-stock' })
    expect(Number((await row('orders', s.order)).total_amount)).toBe(10000 + 5 * 1040)
    expect(Number((await row('products', s.ankle)).inventory_count)).toBe(3)
  })

  it('adds tax on the addition when the store charges it', async () => {
    const s = await seed()
    const result = await acceptOffer({ orderId: s.order, offerId: s.offer, productId: s.crew, variantId: s.crewBlackXl, quantity: 5, charge: charger({ status: 'succeeded' }), taxFor: amount => Math.round(amount * 0.1), now: SOON })
    expect(result.ok).toBe(true)
    const order = await row('orders', s.order)
    expect(Number(order.total_amount)).toBe(10000 + 4800 + 480)
    expect(Number(order.tax_amount)).toBe(480)
  })

  it('refuses what the offer does not allow', async () => {
    const s = await seed()
    const base = { orderId: s.order, offerId: s.offer, charge: 'collect-later' as const, now: SOON }
    expect(await acceptOffer({ ...base, productId: s.crew, variantId: s.crewBlackXl, quantity: 4 })).toMatchObject({ ok: false, reason: 'invalid-quantity' })
    expect(await acceptOffer({ ...base, productId: s.crew, quantity: 5 })).toMatchObject({ ok: false, reason: 'invalid-variant' })
    expect(await acceptOffer({ ...base, productId: s.crew, variantId: 99999, quantity: 5 })).toMatchObject({ ok: false, reason: 'invalid-variant' })
    expect(await acceptOffer({ ...base, productId: s.toeSocks, quantity: 5 })).toMatchObject({ ok: false, reason: 'invalid-product' })
    expect(await acceptOffer({ ...base, productId: s.crew, variantId: s.crewBlackXl, quantity: 5, now: new Date('2026-11-16T13:00:00Z') })).toMatchObject({ ok: false, reason: 'offer-expired' })
    expect(await acceptOffer({ ...base, orderId: 424242, productId: s.crew, variantId: s.crewBlackXl, quantity: 5 })).toMatchObject({ ok: false, reason: 'order-not-found' })
    expect(Number((await row('orders', s.order)).total_amount)).toBe(10000)
  })

  it('releases the stock and keeps the offer open when the card is declined', async () => {
    const s = await seed()
    const declined = await acceptOffer({ orderId: s.order, offerId: s.offer, productId: s.crew, variantId: s.crewBlackXl, quantity: 5, charge: charger({ status: 'failed', failureReason: 'Your card was declined.' }), now: SOON })
    expect(declined).toMatchObject({ ok: false, reason: 'payment-failed', message: 'Your card was declined.' })
    expect(Number((await row('product_variants', s.crewBlackXl)).inventory_count)).toBe(50)
    expect(Number((await row('orders', s.order)).total_amount)).toBe(10000)

    const retry = await acceptOffer({ orderId: s.order, offerId: s.offer, productId: s.crew, variantId: s.crewBlackXl, quantity: 5, charge: charger({ status: 'succeeded' }), now: SOON })
    expect(retry).toMatchObject({ ok: true, status: 'accepted' })
  })

  it('treats a charger that throws as a failed payment', async () => {
    const s = await seed()
    const result = await acceptOffer({ orderId: s.order, offerId: s.offer, productId: s.crew, variantId: s.crewBlackXl, quantity: 5, charge: async () => { throw new Error('network down') }, now: SOON })
    expect(result).toMatchObject({ ok: false, reason: 'payment-failed', message: 'network down' })
    expect(Number((await row('product_variants', s.crewBlackXl)).inventory_count)).toBe(50)
  })

  it('waits for 3-D Secure and lets the webhook finish it, once', async () => {
    const s = await seed()
    const result = await acceptOffer({ orderId: s.order, offerId: s.offer, productId: s.crew, variantId: s.crewBlackXl, quantity: 5, charge: charger({ status: 'requires_action', reference: 'pi_3ds', clientConfirmation: { provider: 'stripe', clientSecret: 'secret' } }), now: SOON })
    expect(result).toMatchObject({ ok: false, reason: 'payment-requires-action', clientConfirmation: { clientSecret: 'secret' } })
    expect(Number((await row('orders', s.order)).total_amount)).toBe(10000)
    // Reserved while the shopper authenticates.
    expect(Number((await row('product_variants', s.crewBlackXl)).inventory_count)).toBe(45)

    const handled = await handleCommercePaymentEvent({ provider: 'stripe', id: 'evt_1', type: 'payment.succeeded', providerType: 'payment_intent.succeeded', reference: 'pi_3ds', merchantReference: null, amount: { amount: 4800, currency: 'usd' } } as any)
    expect(handled).toBe(true)
    expect(Number((await row('orders', s.order)).total_amount)).toBe(14800)
    expect(await completeUpsellPayment('pi_3ds', { succeeded: true })).toBe(false)
    expect(Number((await row('orders', s.order)).total_amount)).toBe(14800)
  })

  it('releases a 3-D Secure acceptance the shopper walked away from', async () => {
    const s = await seed()
    await acceptOffer({ orderId: s.order, offerId: s.offer, productId: s.crew, variantId: s.crewBlackXl, quantity: 5, charge: charger({ status: 'requires_action', reference: 'pi_gone' }), now: SOON })
    expect(await releaseStalePending({ now: new Date(Date.now() + 30 * 60_000) })).toBe(0)
    expect(await releaseStalePending({ now: new Date(Date.now() + 61 * 60_000) })).toBe(1)
    expect(Number((await row('product_variants', s.crewBlackXl)).inventory_count)).toBe(50)
    expect(await completeUpsellPayment('pi_gone', { succeeded: true })).toBe(false)
  })

  it('does not cancel a paid order when an upsell payment fails later', async () => {
    const s = await seed()
    await acceptOffer({ orderId: s.order, offerId: s.offer, productId: s.crew, variantId: s.crewBlackXl, quantity: 5, charge: charger({ status: 'requires_action', reference: 'pi_fail' }), now: SOON })
    await handleCommercePaymentEvent({ provider: 'stripe', id: 'evt_2', type: 'payment.failed', providerType: 'payment_intent.payment_failed', reference: 'pi_fail', merchantReference: null, amount: null, reason: 'Authentication failed' } as any)
    expect((await row('orders', s.order)).status).toBe('PROCESSING')
    expect(Number((await row('product_variants', s.crewBlackXl)).inventory_count)).toBe(50)
  })
})

describe('declining and measuring', () => {
  it('declines what was shown and reports conversion and revenue', async () => {
    const s = await seed()
    await presentOffers(s.order, { now: SOON })
    await acceptOffer({ orderId: s.order, offerId: s.offer, productId: s.crew, variantId: s.crewBlackXl, quantity: 5, charge: 'collect-later', now: SOON })
    expect(await declineOffer(s.order, s.offer)).toBe(1)

    const stats = await offerStats(s.offer)
    expect(stats).toMatchObject({ views: 2, accepted: 1, declined: 1, revenue: 4800, units: 5, conversionRate: 0.5 })
    // Everything answered: the offer is done for this order.
    expect(await eligibleOffers(s.order, { now: SOON })).toEqual([])
  })
})
