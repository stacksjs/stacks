import { beforeEach, describe, expect, it } from 'bun:test'
import { db } from '@stacksjs/database'
import { refreshDatabase } from './setup'

/**
 * The default storefront end to end, through the real Action modules: a cart
 * that earns an automatic "buy 4, get 4 free" is placed as one atomic order,
 * the confirmation key guards the order, and the post-purchase offer on the
 * confirmation page is taken and turned down through the actions its forms
 * post to.
 */

const defaults = '../../../../defaults/app'
const PlaceOrderAction = (await import(`${defaults}/Actions/Storefront/PlaceOrderAction`)).default
const AcceptOrderOfferAction = (await import(`${defaults}/Actions/Storefront/AcceptOrderOfferAction`)).default
const DeclineOrderOfferAction = (await import(`${defaults}/Actions/Storefront/DeclineOrderOfferAction`)).default
const ApplyDiscountCodeAction = (await import(`${defaults}/Actions/Storefront/ApplyDiscountCodeAction`)).default
const { orderForKey } = await import(`${defaults}/Storefront/OrderKey`)

beforeEach(async () => {
  await refreshDatabase()
})

async function insert(table: string, values: Record<string, unknown>): Promise<number> {
  await db.insertInto(table as any).values(values as any).execute()
  const row = await db.selectFrom(table as any).select(['id']).orderBy('id', 'desc').limit(1).executeTakeFirst() as { id: number }
  return Number(row.id)
}

/** The slice of a Stacks request these actions touch: form fields and cookies. */
function request(fields: Record<string, unknown>, cookies: Record<string, string> = {}) {
  const jar = new Map(Object.entries(cookies))
  return {
    get: (name: string) => fields[name],
    cookies: { get: (name: string) => jar.get(name), delete: (name: string) => jar.delete(name), set: (name: string, value: string) => jar.set(name, value) },
  }
}

async function seedCart(quantity: number) {
  const socks = await insert('products', { name: 'Toe Socks', slug: 'toe-socks', price: 2500, is_available: true, inventory_count: 20, preparation_time: 1 })
  const crew = await insert('products', { name: 'Crew Socks', slug: 'crew-socks', price: 2400, is_available: true, inventory_count: 40, preparation_time: 1 })
  const cart = await insert('carts', { session_token: 'cart-token-1', status: 'active', currency: 'USD', expires_at: '2099-01-01 00:00:00', total: 0, email: 'chris@example.com', shipping_name: 'Chris', shipping_address: '1 Ocean Ave', shipping_city: 'Santa Monica', shipping_state: 'CA', shipping_zip: '90405' })
  await insert('cart_items', { cart_id: cart, quantity, unit_price: 2500, total_price: quantity * 2500, product_name: 'Toe Socks', product_sku: 'toe-socks' })
  await insert('discounts', { title: 'BUY 4, GET 4 FREE | 50% OFF', type: 'buy_x_get_y', buy_quantity: 4, get_quantity: 4, get_percent: 100, target: JSON.stringify({ productIds: [socks] }), is_active: true, usage_count: 0 })
  const offer = await insert('post_purchase_offers', { name: 'Sock bundle', message: 'Grab 5+ pairs and get 60% off!', product_ids: JSON.stringify([crew]), discount_percent: 60, min_quantity: 5, default_quantity: 5, window_minutes: 30, is_active: true })
  return { socks, crew, cart, offer }
}

describe('storefront checkout with an automatic discount and a post-purchase offer', () => {
  it('places the discounted order atomically and keys its confirmation page', async () => {
    const s = await seedCart(8)
    const placed = await PlaceOrderAction.handle(request({}, { stacks_cart: 'cart-token-1' }))
    expect(placed).toMatchObject({ ok: true, subtotal: 20000, discount: 10000, shipping: 0, total: 10000 })
    expect(PlaceOrderAction.next(placed)).toBe(`/orders/${placed.order_id}?key=${encodeURIComponent(placed.key)}`)

    const order = await db.selectFrom('orders' as any).where('id', '=', placed.order_id).selectAll().executeTakeFirst() as any
    expect([order.status, Number(order.total_amount), Number(order.discount_amount)]).toEqual(['PROCESSING', 10000, 10000])
    expect(Number((await db.selectFrom('products' as any).where('id', '=', s.socks).selectAll().executeTakeFirst() as any).inventory_count)).toBe(12)
    expect(Number((await db.selectFrom('discounts' as any).selectAll().executeTakeFirst() as any).usage_count)).toBe(1)

    // The key opens it; a missing or wrong one reads as no order at all.
    expect((await orderForKey(placed.order_id, placed.key))?.id).toBe(order.id)
    expect(await orderForKey(placed.order_id, '')).toBeNull()
    expect(await orderForKey(placed.order_id, 'x'.repeat(32))).toBeNull()

    // A second submit of the same cart lands on the same order.
    const again = await PlaceOrderAction.handle(request({}, { stacks_cart: 'cart-token-1' }))
    expect(again).toMatchObject({ ok: true, order_id: placed.order_id, key: placed.key })
  })

  it('refuses rather than oversells', async () => {
    await seedCart(8)
    await db.updateTable('products' as any).set({ inventory_count: 3 } as any).where('slug', '=', 'toe-socks').execute()
    const refused = await PlaceOrderAction.handle(request({}, { stacks_cart: 'cart-token-1' })) as Response
    expect(refused.status).toBe(409)
    expect(await db.selectFrom('orders' as any).selectAll().execute()).toEqual([])
  })

  it('adds the offer to the order from the confirmation page, once, and only with the key', async () => {
    const s = await seedCart(8)
    const placed = await PlaceOrderAction.handle(request({}, { stacks_cart: 'cart-token-1' }))
    const form = { order_id: placed.order_id, key: placed.key, offer_id: s.offer, product_id: s.crew, quantity: '5' }

    const stranger = await AcceptOrderOfferAction.handle(request({ ...form, key: 'nope-nope-nope-nope' })) as Response
    expect(stranger.status).toBe(404)

    const accepted = await AcceptOrderOfferAction.handle(request(form))
    expect(accepted).toMatchObject({ ok: true, status: 'accepted', order_id: placed.order_id })
    expect(AcceptOrderOfferAction.notice(accepted)).toBe('Added to your order.')
    const order = await db.selectFrom('orders' as any).where('id', '=', placed.order_id).selectAll().executeTakeFirst() as any
    // 5 crew pairs at 60% off $24: $48 more.
    expect(Number(order.total_amount)).toBe(10000 + 4800)

    const twice = await AcceptOrderOfferAction.handle(request(form)) as Response
    expect(twice.status).toBe(409)

    const tooFew = await AcceptOrderOfferAction.handle(request({ ...form, quantity: '2' })) as Response
    expect(tooFew.status).toBe(422)
  })

  it('turns the offer down', async () => {
    const s = await seedCart(8)
    const placed = await PlaceOrderAction.handle(request({}, { stacks_cart: 'cart-token-1' }))
    const { upsells } = await import('../index')
    await upsells.presentOffers(placed.order_id)
    const declined = await DeclineOrderOfferAction.handle(request({ order_id: placed.order_id, key: placed.key, offer_id: s.offer }))
    expect(declined).toMatchObject({ ok: true, declined: 1 })
    expect(await upsells.eligibleOffers(placed.order_id)).toEqual([])
  })

  it('applies a discount code from the cart, explains a bad one, and re-checks it at placement', async () => {
    await seedCart(2)
    await insert('discounts', { title: 'Welcome', code: 'WELCOME10', type: 'percentage', value: 10, is_active: true, usage_count: 0, usage_limit: 1 })
    const cookies = { stacks_cart: 'cart-token-1' }

    const unknown = await ApplyDiscountCodeAction.handle(request({ code: 'NOPE' }, cookies)) as Response
    expect(unknown.status).toBe(422)
    expect(await unknown.json()).toMatchObject({ errors: { code: ['That discount code does not exist.'] } })

    const applied = await ApplyDiscountCodeAction.handle(request({ code: 'welcome10' }, cookies))
    expect(applied).toMatchObject({ ok: true, code: 'WELCOME10', discount: 500 })
    expect(ApplyDiscountCodeAction.notice(applied)).toBe('Discount code WELCOME10 applied.')
    expect((await db.selectFrom('carts' as any).selectAll().executeTakeFirst() as any).discount_code).toBe('WELCOME10')

    // Used up by someone else before this shopper places the order.
    await db.updateTable('discounts' as any).set({ usage_count: 1 } as any).where('code', '=', 'WELCOME10').execute()
    const stale = await PlaceOrderAction.handle(request({}, cookies)) as Response
    expect(stale.status).toBe(409)
    expect((await db.selectFrom('carts' as any).selectAll().executeTakeFirst() as any).discount_code).toBeNull()

    // Without it, the order goes through at the price now shown.
    const placed = await PlaceOrderAction.handle(request({}, cookies))
    expect(placed).toMatchObject({ ok: true, subtotal: 5000, discount: 0 })
  })

  it('charges the code\'s price when it still applies, and counts the use', async () => {
    await seedCart(2)
    await insert('discounts', { title: 'Welcome', code: 'WELCOME10', type: 'percentage', value: 10, is_active: true, usage_count: 0 })
    const cookies = { stacks_cart: 'cart-token-1' }
    await ApplyDiscountCodeAction.handle(request({ code: 'WELCOME10' }, cookies))
    const placed = await PlaceOrderAction.handle(request({}, cookies))
    // $50 of socks, 10% off: $45, which still clears the $40 free-shipping line.
    expect(placed).toMatchObject({ ok: true, subtotal: 5000, discount: 500, shipping: 0, total: 4500 })
    expect(Number((await db.selectFrom('discounts' as any).where('code', '=', 'WELCOME10').selectAll().executeTakeFirst() as any).usage_count)).toBe(1)

    const removed = await ApplyDiscountCodeAction.handle(request({ remove: '1' }, cookies)) as Response
    // The cart became an order, so there is no active cart to change.
    expect(removed.status).toBe(400)
  })
})
