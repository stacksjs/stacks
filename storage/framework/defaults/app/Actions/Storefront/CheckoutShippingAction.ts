import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { readCartCookie } from '../../Storefront/CartCookie'

const CART_COOKIE = 'stacks_cart'

/**
 * Step 2 of multi-step checkout. Saves shipping address fields on the
 * cart and advances to the payment step.
 */
export default new Action({
  name: 'CheckoutShippingAction',
  description: 'Save shipping address on the active cart.',
  method: 'POST',

  async handle(request: any) {
    const name = String(request.get('shipping_name') ?? '').trim()
    const address = String(request.get('shipping_address') ?? '').trim()
    const city = String(request.get('shipping_city') ?? '').trim()
    const state = String(request.get('shipping_state') ?? '').trim()
    const zip = String(request.get('shipping_zip') ?? '').trim()

    if (!name || !address || !city || !state || !zip)
      return response.json({ error: 'All shipping fields are required.' }, { status: 422 })

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
      .set({
        shipping_name: name,
        shipping_address: address,
        shipping_city: city,
        shipping_state: state,
        shipping_zip: zip,
        checkout_step: 'payment',
      })
      .where('id', '=', cart.id)
      .execute()

    const wantsHtml = (request.headers?.get?.('accept') || '').includes('text/html')
    const xhr = request.headers?.get?.('x-requested-with') === 'XMLHttpRequest'
    if (wantsHtml && !xhr)
      return response.redirect('/checkout/payment')

    return response.json({ ok: true, next: '/checkout/payment' })
  },
})
