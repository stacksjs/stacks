import { Action } from '@stacksjs/actions/runtime'
import { db } from '@stacksjs/database/runtime'
import { refuse } from '@stacksjs/router'
import { schema } from '@stacksjs/validation/runtime'
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
  // A browser form goes on to the next step; a script gets `next` in the body.
  next: '/checkout/shipping',

  // Declared, so the router answers a wrong address the way the caller asked
  // to be answered: the checkout page gets the shopper back on the contact
  // step with the message under the field and what they typed still in it,
  // and a script gets the 422 body. Checked by hand in `handle`, a form was
  // answered with a page of JSON (stacksjs/stacks#3309).
  validations: {
    email: { rule: schema.string().email().required(), message: 'Enter a valid email address.' },
  },

  async handle(request: any) {
    const email = String(request.get('email') ?? '').trim().toLowerCase()
    // For a caller that runs the action without the router in front of it.
    if (!email || !email.includes('@'))
      return refuse('Enter a valid email address.', { field: 'email' })

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
      .set({ email, checkout_step: 'shipping' })
      .where('id', '=', cart.id)
      .execute()

    return { ok: true, next: '/checkout/shipping' }
  },
})
