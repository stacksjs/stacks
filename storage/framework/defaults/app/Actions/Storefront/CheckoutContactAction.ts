import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { readCartCookie } from '../../Storefront/CartCookie'

const CART_COOKIE = 'stacks_cart'

/**
 * Step 1 of multi-step checkout. Persists the shopper's email on the
 * cart row and bumps the cart's `checkout_step` so a refresh on the
 * shipping page knows which step the shopper is actually on.
 */
export default new Action({
  name: 'CheckoutContactAction',
  description: 'Save the shopper email on the active cart.',
  method: 'POST',

  async handle(request: any) {
    const email = String(request.get('email') ?? '').trim().toLowerCase()
    if (!email || !email.includes('@'))
      return response.json({ error: 'A valid email is required.' }, { status: 422 })

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

    await (db as any)
      .updateTable('carts')
      .set({ email, checkout_step: 'shipping' })
      .where('id', '=', cart.id)
      .execute()

    const wantsHtml = (request.headers?.get?.('accept') || '').includes('text/html')
    const xhr = request.headers?.get?.('x-requested-with') === 'XMLHttpRequest'
    if (wantsHtml && !xhr)
      return response.redirect('/checkout/shipping')

    return response.json({ ok: true, next: '/checkout/shipping' })
  },
})
