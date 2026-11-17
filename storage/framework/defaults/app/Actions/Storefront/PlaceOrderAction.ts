import type { DiscountRule } from '@stacksjs/commerce/discounts/engine'
import type { StorefrontLine } from '../../Storefront/StorefrontPricing'
import { randomBytes } from 'node:crypto'
import { randomUUIDv7 } from 'bun'
import { Action } from '@stacksjs/actions/runtime'
import { customers, discounts, orders } from '@stacksjs/commerce'
import { config } from '@stacksjs/config'
import { db } from '@stacksjs/database/runtime'
import { refuse } from '@stacksjs/router'
import { sendOrderConfirmation } from '../../Mail/OrderConfirmation'
import { readCartCookie } from '../../Storefront/CartCookie'
import { DISCOUNT_CODE_MESSAGES } from '../../Storefront/DiscountCodeMessages'
import { storefrontCurrency } from '../../Storefront/StorefrontMoney'
import { priceStorefront } from '../../Storefront/StorefrontPricing'

const CART_COOKIE = 'stacks_cart'

/**
 * Step 3 of multi-step checkout — the actual "place order" call.
 *
 * Pulls everything we collected in earlier steps off the cart row
 * (email + shipping_*), creates a Customer if we don't have one for
 * this email yet, prices the cart with the store's automatic discounts
 * (the same `priceStorefront` the cart and checkout pages show), and
 * writes the order, its lines and the stock it takes in ONE transaction
 * through `commerce.orders.placeOrder`: a line that cannot be stocked
 * refuses the order instead of overselling, and a double-submitted form
 * returns the order the first submit placed.
 *
 * The confirmation page is opened with the order's unguessable
 * `tracking_token` as `?key=`, so a sequential order id alone shows
 * nobody's name, email or address.
 *
 * No real card is charged — a payment call would slot in between the
 * pricing and the placement. The mock card form on the payment view
 * doesn't actually submit any sensitive data.
 */
export default new Action({
  name: 'PlaceOrderAction',
  description: 'Convert the active cart into an Order + OrderItems.',
  method: 'POST',
  // A browser form goes to the order it placed; a script gets its id and totals.
  next: (result: { order_id: number, key: string }) => `/orders/${result.order_id}?key=${encodeURIComponent(result.key)}`,

  async handle(request: any) {
    const token = readCartCookie(request, CART_COOKIE)
    if (!token)
      return refuse('Your cart is empty.', { status: 400 })

    const cart = await (db as any)
      .selectFrom('carts')
      .where('session_token', '=', token)
      .selectAll()
      .executeTakeFirst()

    if (!cart || (cart.status !== 'active' && cart.status !== 'converted'))
      return refuse('Your cart is empty.', { status: 400 })

    // A second submit of a cart that already became an order (a double click,
    // a resubmitted form after a slow response) lands on that order.
    if (cart.status === 'converted') {
      const placed = await orders.findOrderByIdempotencyKey(`storefront-cart-${cart.id}`)
      if (placed?.tracking_token)
        return { ok: true, order_id: Number(placed.id), key: String(placed.tracking_token), total: Number(placed.total_amount) }
      return refuse('Your cart is empty.', { status: 400 })
    }

    const items = await (db as any)
      .selectFrom('cart_items')
      .where('cart_id', '=', cart.id)
      .selectAll()
      .execute()

    if (items.length === 0)
      return refuse('Your cart is empty.', { status: 400 })

    if (!cart.email || !cart.shipping_name || !cart.shipping_address)
      return refuse('Checkout details are incomplete. Go back and fill in your email and shipping address.')

    // Every cart line has to still be a product we sell.
    const products = new Map<string, any>()
    for (const item of items) {
      const product = await (db as any)
        .selectFrom('products')
        .where('slug', '=', item.product_sku)
        .selectAll()
        .executeTakeFirst()
      if (!product || product.is_available === 0 || product.is_available === false)
        return refuse(`${item.product_name || 'An item in your cart'} is no longer available. Remove it to continue.`)
      products.set(item.product_sku, product)
    }

    // One customer per email — repeat shoppers reuse the same row so
    // the dashboard's customer total isn't inflated by checkouts.
    let customer = await (db as any)
      .selectFrom('customers')
      .where('email', '=', cart.email)
      .selectAll()
      .executeTakeFirst()

    // Through commerce's store, which fills what the table requires and the
    // checkout does not ask for, such as the avatar (#3017).
    if (!customer)
      customer = await customers.store({ name: cart.shipping_name, email: cart.email, uuid: randomUUIDv7() } as never)

    // Integer minor units of the cart's currency, like every amount here.
    const currency = storefrontCurrency(cart.currency)
    const lines: StorefrontLine[] = items.map((item: any) => {
      const product = products.get(item.product_sku)
      return {
        id: Number(item.id),
        productId: Number(product.id),
        categoryId: product.category_id == null ? null : Number(product.category_id),
        quantity: Number(item.quantity),
        unitPrice: Math.round(Number(item.unit_price)),
      }
    })

    const codes: string[] = cart.discount_code ? [String(cart.discount_code)] : []
    let rules: DiscountRule[] = []
    try {
      rules = await discounts.fetchRules({ codes })
    }
    catch (error) {
      // An app that has not migrated the discounts table yet sells at full price.
      console.warn(`[PlaceOrderAction] automatic discounts unavailable: ${error instanceof Error ? error.message : String(error)}`)
    }
    const priced = priceStorefront(lines, rules, currency, new Date(), codes)

    // The code was good when it was applied; it can have expired or run out
    // since. Say so and take it off, rather than charge a price the shopper
    // was not shown.
    const rejected = priced.result.rejectedCodes[0]
    if (rejected) {
      await (db as any).updateTable('carts').set({ discount_code: null }).where('id', '=', cart.id).execute()
      return refuse(`${DISCOUNT_CODE_MESSAGES[rejected.reason]} We took it off your cart; check the new total and place your order again.`, { status: 409 })
    }
    const discountTitle = priced.result.applied.filter(a => a.class !== 'shipping').map(a => a.title).join(', ')

    const fullAddress = [
      cart.shipping_address,
      [cart.shipping_city, cart.shipping_state, cart.shipping_zip].filter(Boolean).join(', '),
    ].filter(Boolean).join('\n')

    const trackingToken = randomBytes(24).toString('base64url')

    // Stock is taken only where it is tracked; NULL means "not counted".
    const inventory = items
      .map((item: any) => ({ product: products.get(item.product_sku), quantity: Number(item.quantity) }))
      .filter(({ product }: { product: any }) => product.inventory_count != null)
      .map(({ product, quantity }: { product: any, quantity: number }) => ({ id: Number(product.id), delta: -quantity }))

    const placed = await orders.placeOrder({
      order: {
        customer_id: customer.id,
        status: 'PROCESSING',
        order_type: 'shipping',
        total_amount: priced.total,
        discount_amount: priced.discount,
        currency,
        delivery_fee: priced.shipping,
        delivery_address: fullAddress,
        tracking_token: trackingToken,
      } as never,
      items: items.map((item: any) => ({
        productId: Number(products.get(item.product_sku).id),
        quantity: Number(item.quantity),
        price: Math.round(Number(item.unit_price)),
      })),
      inventory: mergeInventory(inventory),
      idempotencyKey: `storefront-cart-${cart.id}`,
    })

    if (!placed.ok) {
      if (placed.reason === 'out-of-stock')
        return refuse('Sorry, part of your order just sold out. Check your cart and try again.', { status: 409 })
      throw placed.error instanceof Error ? placed.error : new Error(`Order placement failed: ${placed.reason}`)
    }

    const order = placed.order as Record<string, any>
    const key = String(order.tracking_token || trackingToken)

    // Count each discount's use. The order stands either way: the shopper was
    // shown and charged this price, so a limit reached by a concurrent
    // checkout is logged for the merchant rather than taken back.
    if (priced.result.applied.length > 0) {
      try {
        for (const outcome of await discounts.redeemApplied(priced.result.applied)) {
          if (!outcome.ok && outcome.reason !== 'not-stored')
            console.warn(`[PlaceOrderAction] order #${order.id} used discount ${String(outcome.ruleId)} past its limit (${outcome.reason}).`)
        }
      }
      catch (error) {
        console.warn(`[PlaceOrderAction] could not count discount uses for order #${order.id}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    await (db as any)
      .updateTable('carts')
      .set({ status: 'converted', checkout_step: 'placed' })
      .where('id', '=', cart.id)
      .execute()

    request.cookies?.delete?.(CART_COOKIE, { path: '/' })

    // Fire the receipt email asynchronously so a mailer hiccup
    // never fails an otherwise-good checkout. The customer can still
    // see their order on the post-checkout page even if the email
    // never lands.
    const baseUrl = (() => {
      let raw = process.env.APP_URL || config.app.url || ''
      if (raw && !/^https?:\/\//i.test(raw)) raw = `https://${raw}`
      return raw.replace(/\/$/, '')
    })()
    sendOrderConfirmation({
      to: cart.email,
      orderId: order.id,
      customerName: cart.shipping_name || customer.name,
      items: items.map((row: any) => ({
        name: row.product_name,
        qty: Number(row.quantity),
        lineTotal: Number(row.total_price || 0),
      })),
      currency,
      subtotal: priced.subtotal,
      discount: priced.discount,
      discountTitle,
      shipping: priced.shipping,
      total: priced.total,
      shippingAddress: fullAddress,
      orderUrl: `${baseUrl}/orders/${order.id}?key=${encodeURIComponent(key)}`,
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[PlaceOrderAction] order receipt email failed for order #${order.id}:`, message)
    })

    return {
      ok: true,
      order_id: Number(order.id),
      key,
      total: priced.total,
      subtotal: priced.subtotal,
      discount: priced.discount,
      shipping: priced.shipping,
    }
  },
})

/** One stock movement per product, so two lines of one product are checked together. */
function mergeInventory(moves: Array<{ id: number, delta: number }>): Array<{ id: number, delta: number }> {
  const merged = new Map<number, number>()
  for (const { id, delta } of moves)
    merged.set(id, (merged.get(id) ?? 0) + delta)
  return [...merged].map(([id, delta]) => ({ id, delta }))
}
