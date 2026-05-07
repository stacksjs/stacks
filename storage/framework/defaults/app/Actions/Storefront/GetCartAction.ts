import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { readCartCookie } from '../../Storefront/CartCookie'

const CART_COOKIE = 'stacks_cart'

/**
 * Read-only cart endpoint used by the slide-in CartDrawer to refresh
 * its contents after an add/remove. Returns the same shape the drawer
 * renders directly so the client doesn't have to do any reshaping.
 */
export default new Action({
  name: 'GetCartAction',
  description: 'Return the current cart for the caller cookie.',
  method: 'GET',

  async handle(request: any) {
    // Verify HMAC; tampered cookies behave the same as no cookie at
    // all — return an empty cart shell instead of looking up the
    // forged token. Legacy unsigned tokens parse through.
    const token = readCartCookie(request, CART_COOKIE)
    if (!token)
      return response.json({ items: [], subtotal: 0, total_items: 0 })

    const cart = await (db as any)
      .selectFrom('carts')
      .where('session_token', '=', token)
      .where('status', '=', 'active')
      .selectAll()
      .executeTakeFirst()

    if (!cart)
      return response.json({ items: [], subtotal: 0, total_items: 0 })

    const rawItems = await (db as any)
      .selectFrom('cart_items')
      .where('cart_id', '=', cart.id)
      .selectAll()
      .execute()

    const items = rawItems.map((row: any) => ({
      id: row.id,
      slug: row.product_sku,
      name: row.product_name,
      image: row.product_image,
      qty: Number(row.quantity),
      price: Number(row.unit_price),
      lineTotal: Number(row.total_price || 0),
    }))

    return response.json({
      items,
      total_items: Number(cart.total_items || 0),
      subtotal: Number(cart.subtotal || 0),
    })
  },
})
