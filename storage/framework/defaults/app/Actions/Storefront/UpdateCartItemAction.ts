import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { readCartCookie } from '../../Storefront/CartCookie'

const CART_COOKIE = 'stacks_cart'

/**
 * Change the quantity of a cart line, or remove it (quantity=0).
 * Scoped by the caller's cart cookie so one shopper can't poke at
 * another's cart by guessing item ids.
 */
export default new Action({
  name: 'UpdateCartItemAction',
  description: 'Update or remove a cart item by id, scoped to caller cookie.',
  method: 'POST',

  async handle(request: any) {
    const itemId = Number(request.get('item_id') ?? 0)
    const quantity = Math.max(0, Math.min(99, Number(request.get('quantity') ?? 1)))

    // HMAC-verified cookie. Tampered tokens look like "no cookie" so
    // an attacker can't probe for the existence of arbitrary carts.
    const token = readCartCookie(request, CART_COOKIE)
    if (!token)
      return response.json({ error: 'No active cart' }, { status: 400 })

    const cart = await (db as any)
      .selectFrom('carts')
      .where('session_token', '=', token)
      .selectAll()
      .executeTakeFirst()

    if (!cart)
      return response.json({ error: 'Cart not found' }, { status: 404 })

    const item = await (db as any)
      .selectFrom('cart_items')
      .where('id', '=', itemId)
      .where('cart_id', '=', cart.id)
      .selectAll()
      .executeTakeFirst()

    if (!item)
      return response.json({ error: 'Item not in your cart' }, { status: 404 })

    if (quantity === 0) {
      await (db as any).deleteFrom('cart_items').where('id', '=', item.id).execute()
    }
    else {
      await (db as any)
        .updateTable('cart_items')
        .set({
          quantity,
          total_price: quantity * Number(item.unit_price),
        })
        .where('id', '=', item.id)
        .execute()
    }

    const items = await (db as any)
      .selectFrom('cart_items')
      .where('cart_id', '=', cart.id)
      .selectAll()
      .execute()

    const totalItems = items.reduce((s: number, i: any) => s + Number(i.quantity), 0)
    const subtotal = items.reduce((s: number, i: any) => s + Number(i.total_price || 0), 0)

    await (db as any)
      .updateTable('carts')
      .set({ total_items: totalItems, subtotal, total: subtotal })
      .where('id', '=', cart.id)
      .execute()

    const wantsHtml = (request.headers?.get?.('accept') || '').includes('text/html')
    const xhr = request.headers?.get?.('x-requested-with') === 'XMLHttpRequest'
    if (wantsHtml && !xhr)
      return response.redirect('/cart')

    return response.json({ ok: true, total_items: totalItems, subtotal })
  },
})
