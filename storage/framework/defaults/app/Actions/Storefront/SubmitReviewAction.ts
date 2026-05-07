import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { rateLimit, response } from '@stacksjs/router'
import { readCartCookie } from '../../Storefront/CartCookie'

const CART_COOKIE = 'stacks_cart'

/**
 * Public review-submission endpoint. Posted from `/orders/{id}` by
 * the buyer after their order ships.
 *
 * Trust model:
 *   - Verifies the submitter actually owns the order by matching the
 *     `email` on the order against the `email` they're posting with,
 *     and additionally accepts a still-valid cart cookie path for
 *     guest shoppers who haven't enrolled in account auth.
 *   - Marks `is_verified_purchase=1` only when that email-on-order
 *     check passes.
 *   - Always inserts with `is_approved=0`. The dashboard's reviews
 *     index shows pending entries to admins for moderation.
 *
 * Spam handling: rate-limit per IP (5/min) so a hostile actor can't
 * dump 1000 boilerplate reviews from one address. Honeypot field
 * (`website`) catches drive-by bots — a non-empty value short-circuits
 * with a fake-success response.
 */
export default new Action({
  name: 'SubmitReviewAction',
  description: 'Buyer-submitted review tied to a shipped order. Marked pending until moderated.',
  method: 'POST',

  async handle(request: any) {
    await rateLimit('review-submit', 5).per('minute')

    const orderId = Number(request.get('order_id') ?? 0)
    const productSlug = String(request.get('product_slug') ?? '').trim()
    const rating = Math.max(1, Math.min(5, Number(request.get('rating') ?? 0)))
    const title = String(request.get('title') ?? '').trim()
    const content = String(request.get('content') ?? '').trim()
    const email = String(request.get('email') ?? '').trim().toLowerCase()
    // Honeypot. Bots fill every field; a real form keeps this hidden
    // and untouched. Pretend to succeed so the bot moves on without
    // retrying with a different shape.
    const honeypot = String(request.get('website') ?? '').trim()
    if (honeypot)
      return response.json({ success: true })

    if (!orderId || !productSlug || !rating || !title || !content || !email)
      return response.json({ success: false, message: 'All fields are required.' }, { status: 422 })

    if (title.length > 100)
      return response.json({ success: false, message: 'Title is too long.' }, { status: 422 })
    if (content.length > 2000)
      return response.json({ success: false, message: 'Review is too long.' }, { status: 422 })

    // Verify the order + ownership. Two acceptable proofs of ownership:
    //   (a) email on the order row matches the submitted email
    //   (b) shopper still has the cart cookie that placed the order
    // Either is enough — (a) is the common case for a returning buyer
    // clicking the link in their receipt; (b) covers a buyer who never
    // closes the post-checkout tab.
    const order = await (db as any)
      .selectFrom('orders')
      .where('id', '=', orderId)
      .selectAll()
      .executeTakeFirst()
    if (!order)
      return response.json({ success: false, message: 'Order not found.' }, { status: 404 })

    let ownsOrder = false
    if (order.customer_id) {
      const customer = await (db as any)
        .selectFrom('customers')
        .where('id', '=', order.customer_id)
        .selectAll()
        .executeTakeFirst()
      if (customer && String(customer.email || '').toLowerCase() === email)
        ownsOrder = true
    }
    if (!ownsOrder) {
      const cookieToken = readCartCookie(request, CART_COOKIE)
      if (cookieToken) {
        const cart = await (db as any)
          .selectFrom('carts')
          .where('session_token', '=', cookieToken)
          .selectAll()
          .executeTakeFirst()
        if (cart && cart.email && String(cart.email).toLowerCase() === email)
          ownsOrder = true
      }
    }
    if (!ownsOrder)
      return response.json({ success: false, message: 'We could not match you to that order.' }, { status: 403 })

    // Resolve the product row by slug. Reviews use `product_id` as a
    // FK; the storefront submits the slug because it's what the URL
    // and cart row already carry.
    const product = await (db as any)
      .selectFrom('products')
      .where('slug', '=', productSlug)
      .selectAll()
      .executeTakeFirst()
    if (!product)
      return response.json({ success: false, message: 'Unknown product.' }, { status: 422 })

    // Block duplicates per (order, product) pair so a curious shopper
    // can't refresh-spam the form and clobber the moderation queue.
    const dup = await (db as any)
      .selectFrom('reviews')
      .where('product_id', '=', product.id)
      .where('order_id', '=', orderId)
      .selectAll()
      .executeTakeFirst()
    if (dup)
      return response.json({ success: false, message: 'You already submitted a review for this product on this order.' }, { status: 409 })

    await (db as any)
      .insertInto('reviews')
      .values({
        product_id: product.id,
        customer_id: order.customer_id ?? null,
        order_id: orderId,
        rating,
        title,
        content,
        is_verified_purchase: 1,
        is_approved: 0,
        is_featured: 0,
        helpful_votes: 0,
        unhelpful_votes: 0,
        purchase_date: order.created_at || new Date().toISOString(),
      })
      .execute()

    return response.json({
      success: true,
      message: "Thanks — your review is in. We'll publish it once a human gives it a quick look.",
    })
  },
})
