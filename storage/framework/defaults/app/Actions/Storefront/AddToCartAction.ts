import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { randomUUIDv7 } from 'bun'
import { readCartCookie, writeCartCookie } from '../../Storefront/CartCookie'

const CART_COOKIE = 'stacks_cart'
const COOKIE_OPTS = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 30, // 30 days
}

/**
 * Add a product to the shopper's cart.
 *
 * - Anonymous, cookie-keyed: a `stacks_cart` cookie holds a random
 *   `session_token` that points at a row in `carts`. We create the cart
 *   on first add so empty visitors don't litter the table.
 * - Idempotent per product: if the same slug is already in the cart we
 *   bump the existing line's quantity instead of inserting a duplicate.
 * - Form vs XHR: a normal HTML form post redirects to /cart so the
 *   back button works; XHR callers (the cart drawer) get JSON and
 *   stay on the current page.
 */
export default new Action({
  name: 'AddToCartAction',
  description: 'Add a product to the anonymous cart, keyed by cookie session.',
  method: 'POST',

  async handle(request: any) {
    const slug = String(request.get('slug') ?? '').trim()
    const quantity = Math.max(1, Math.min(99, Number(request.get('quantity') ?? 1) || 1))

    if (!slug)
      return response.json({ error: 'A product slug is required.' }, { status: 422 })

    const product = await (db as any)
      .selectFrom('products')
      .where('slug', '=', slug)
      .where('is_available', '=', 1)
      .selectAll()
      .executeTakeFirst()

    if (!product)
      return response.json({ error: `Product "${slug}" not found` }, { status: 404 })

    // readCartCookie verifies the HMAC; tampered cookies return null
    // and the action falls through to the "create new cart" branch as
    // if no cookie were present. Legacy unsigned tokens are accepted
    // once and re-signed on the next write below.
    let token = readCartCookie(request, CART_COOKIE)
    let cart = token
      ? await (db as any).selectFrom('carts').where('session_token', '=', token).selectAll().executeTakeFirst()
      : null

    if (!cart) {
      token = randomUUIDv7()
      await (db as any)
        .insertInto('carts')
        .values({
          status: 'active',
          total_items: 0,
          subtotal: 0,
          total: 0,
          currency: 'USD',
          session_token: token,
          checkout_step: 'cart',
        })
        .execute()
      // Re-read by session_token: bun-query-builder's `returningAll()`
      // returns metadata (lastInsertRowid) on sqlite rather than the
      // full row, so we look up by token to grab a real id we can use
      // for the cart_items FK.
      cart = await (db as any)
        .selectFrom('carts')
        .where('session_token', '=', token)
        .selectAll()
        .executeTakeFirst()
      writeCartCookie(request, CART_COOKIE, token, COOKIE_OPTS)
    }
    else if (!(request.cookies?.get?.(CART_COOKIE) ?? '').includes('.')) {
      // Re-sign legacy carts opportunistically so the next request
      // round-trips with the HMAC variant. Cheap — one cookie set per
      // legacy shopper, then never again.
      writeCartCookie(request, CART_COOKIE, token!, COOKIE_OPTS)
    }

    // Look for an existing line for the same product to bump quantity.
    const existingItem = await (db as any)
      .selectFrom('cart_items')
      .where('cart_id', '=', cart.id)
      .where('product_sku', '=', product.slug)
      .selectAll()
      .executeTakeFirst()

    if (existingItem) {
      const newQty = Number(existingItem.quantity) + quantity
      await (db as any)
        .updateTable('cart_items')
        .set({
          quantity: newQty,
          total_price: newQty * Number(existingItem.unit_price),
        })
        .where('id', '=', existingItem.id)
        .execute()
    }
    else {
      await (db as any)
        .insertInto('cart_items')
        .values({
          cart_id: cart.id,
          quantity,
          unit_price: Number(product.price),
          total_price: quantity * Number(product.price),
          product_name: product.name,
          product_sku: product.slug,
          product_image: product.image_url,
        })
        .execute()
    }

    await recomputeCartTotals(cart.id)

    // Browser form post → redirect; XHR (cart drawer) → JSON.
    const wantsHtml = (request.headers?.get?.('accept') || '').includes('text/html')
    const xhr = request.headers?.get?.('x-requested-with') === 'XMLHttpRequest'
    const redirectTarget = String(request.get('redirect') ?? '/cart')

    if (wantsHtml && !xhr)
      return response.redirect(redirectTarget)

    return response.json({ ok: true, cart_id: cart.id })
  },
})

async function recomputeCartTotals(cartId: number): Promise<void> {
  const items = await (db as any)
    .selectFrom('cart_items')
    .where('cart_id', '=', cartId)
    .selectAll()
    .execute()

  const totalItems = items.reduce((s: number, i: any) => s + Number(i.quantity), 0)
  const subtotal = items.reduce((s: number, i: any) => s + Number(i.total_price || 0), 0)

  await (db as any)
    .updateTable('carts')
    .set({ total_items: totalItems, subtotal, total: subtotal })
    .where('id', '=', cartId)
    .execute()
}
