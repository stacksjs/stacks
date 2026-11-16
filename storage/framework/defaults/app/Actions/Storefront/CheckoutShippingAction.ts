import { Action } from '@stacksjs/actions/runtime'
import { db } from '@stacksjs/database/runtime'
import { refuse } from '@stacksjs/router'
import { schema } from '@stacksjs/validation/runtime'
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
  // A browser form goes on to the next step; a script gets `next` in the body.
  next: '/checkout/payment',

  // Declared, so a missing field is answered the way the caller asked: the
  // checkout page gets the shopper back with the message under the field and
  // what they typed kept (stacksjs/stacks#3311). A field of spaces is missing.
  validations: {
    shipping_name: { rule: schema.string().matches(/\S/).required(), message: 'Enter the name to ship to.' },
    shipping_address: { rule: schema.string().matches(/\S/).required(), message: 'Enter the street address.' },
    shipping_city: { rule: schema.string().matches(/\S/).required(), message: 'Enter the city.' },
    shipping_state: { rule: schema.string().matches(/\S/).required(), message: 'Enter the state.' },
    shipping_zip: { rule: schema.string().matches(/\S/).required(), message: 'Enter the ZIP or postal code.' },
  },

  async handle(request: any) {
    const name = String(request.get('shipping_name') ?? '').trim()
    const address = String(request.get('shipping_address') ?? '').trim()
    const city = String(request.get('shipping_city') ?? '').trim()
    const state = String(request.get('shipping_state') ?? '').trim()
    const zip = String(request.get('shipping_zip') ?? '').trim()

    // For a caller that runs the action without the router in front of it.
    if (!name || !address || !city || !state || !zip)
      return refuse('All shipping fields are required.')

    const token = readCartCookie(request, CART_COOKIE)
    if (!token)
      return refuse('Your cart is empty.', { status: 400 })

    const cart = await (db as any)
      .selectFrom('carts')
      .where('session_token', '=', token)
      .where('status', '=', 'active')
      .selectAll()
      .executeTakeFirst()

    if (!cart)
      return refuse('Your cart is empty.', { status: 400 })

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

    return { ok: true, next: '/checkout/payment' }
  },
})
