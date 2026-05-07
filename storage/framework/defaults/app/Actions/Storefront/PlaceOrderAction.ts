import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { sendOrderConfirmation } from '../../Mail/OrderConfirmation'
import { readCartCookie } from '../../Storefront/CartCookie'
import { totalsFor } from './_shipping'

const CART_COOKIE = 'stacks_cart'

/**
 * Step 3 of multi-step checkout — the actual "place order" call.
 *
 * Pulls everything we collected in earlier steps off the cart row
 * (email + shipping_*), creates a Customer if we don't have one for
 * this email yet, materializes an Order + OrderItems, decrements
 * inventory, marks the cart as `converted`, and clears the cookie so
 * a refresh starts fresh.
 *
 * No real card is charged — a Stripe call would slot in between the
 * cart lookup and the order creation. The mock card form on the
 * payment view doesn't actually submit any sensitive data.
 */
export default new Action({
  name: 'PlaceOrderAction',
  description: 'Convert the active cart into an Order + OrderItems.',
  method: 'POST',

  async handle(request: any) {
    const token = readCartCookie(request, CART_COOKIE)
    if (!token)
      return response.json({ error: 'Your cart is empty.' }, { status: 400 })

    const cart = await (db as any)
      .selectFrom('carts')
      .where('session_token', '=', token)
      .where('status', '=', 'active')
      .selectAll()
      .executeTakeFirst()

    if (!cart)
      return response.json({ error: 'Your cart is empty.' }, { status: 400 })

    const items = await (db as any)
      .selectFrom('cart_items')
      .where('cart_id', '=', cart.id)
      .selectAll()
      .execute()

    if (items.length === 0)
      return response.json({ error: 'Your cart is empty.' }, { status: 400 })

    if (!cart.email || !cart.shipping_name || !cart.shipping_address)
      return response.json({ error: 'Checkout details are incomplete.' }, { status: 422 })

    // One customer per email — repeat shoppers reuse the same row so
    // the dashboard's customer total isn't inflated by checkouts.
    let customer = await (db as any)
      .selectFrom('customers')
      .where('email', '=', cart.email)
      .selectAll()
      .executeTakeFirst()

    if (!customer) {
      await (db as any)
        .insertInto('customers')
        .values({ name: cart.shipping_name, email: cart.email })
        .execute()
      customer = await (db as any)
        .selectFrom('customers')
        .where('email', '=', cart.email)
        .selectAll()
        .executeTakeFirst()
    }

    const itemsSubtotal = items.reduce((s: number, i: any) => s + Number(i.total_price || 0), 0)
    const { subtotal, shipping, total } = totalsFor(itemsSubtotal)

    const fullAddress = [
      cart.shipping_address,
      [cart.shipping_city, cart.shipping_state, cart.shipping_zip].filter(Boolean).join(', '),
    ].filter(Boolean).join('\n')

    await (db as any)
      .insertInto('orders')
      .values({
        customer_id: customer.id,
        status: 'paid',
        order_type: 'shipping',
        total_amount: total,
        delivery_fee: shipping,
        delivery_address: fullAddress,
      })
      .execute()
    // Re-read latest order for this customer — RETURNING * doesn't
    // round-trip the row reliably on sqlite via bun-query-builder.
    const order = await (db as any)
      .selectFrom('orders')
      .where('customer_id', '=', customer.id)
      .orderBy('id', 'desc')
      .limit(1)
      .selectAll()
      .executeTakeFirst()

    // Map cart_items → order_items, resolving product_id by SKU.
    for (const item of items) {
      const product = await (db as any)
        .selectFrom('products')
        .where('slug', '=', item.product_sku)
        .selectAll()
        .executeTakeFirst()

      await (db as any)
        .insertInto('order_items')
        .values({
          order_id: order.id,
          product_id: product?.id ?? null,
          quantity: Number(item.quantity),
          price: Number(item.unit_price),
        })
        .execute()
    }

    // Decrement inventory for what we just sold. Best-effort — we
    // already accepted the order, so a stock-row miss shouldn't
    // fail the response.
    for (const item of items) {
      try {
        const product = await (db as any)
          .selectFrom('products')
          .where('slug', '=', item.product_sku)
          .selectAll()
          .executeTakeFirst()
        if (product) {
          const next = Math.max(0, Number(product.inventory_count || 0) - Number(item.quantity))
          await (db as any)
            .updateTable('products')
            .set({ inventory_count: next })
            .where('id', '=', product.id)
            .execute()
        }
      }
      catch { /* keep going */ }
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
      subtotal,
      shipping,
      total,
      shippingAddress: fullAddress,
      orderUrl: `${baseUrl}/orders/${order.id}`,
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[PlaceOrderAction] order receipt email failed for order #${order.id}:`, message)
    })

    const wantsHtml = (request.headers?.get?.('accept') || '').includes('text/html')
    const xhr = request.headers?.get?.('x-requested-with') === 'XMLHttpRequest'
    if (wantsHtml && !xhr)
      return response.redirect(`/orders/${order.id}`)

    return response.json({
      ok: true,
      order_id: order.id,
      total,
      subtotal,
      shipping,
    })
  },
})
