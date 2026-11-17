import { Action } from '@stacksjs/actions/runtime'
import { upsells } from '@stacksjs/commerce'
import { refuse } from '@stacksjs/router'
import { orderForKey } from '../../Storefront/OrderKey'
import { storefrontUpsellCharger } from '../../Storefront/UpsellCharge'

/**
 * "Add to order" on the confirmation page: take a post-purchase offer.
 *
 * Authorised by the order's key, like the page itself. The price comes from
 * the catalog and the offer, never from the form; `commerce.upsells` claims
 * the offer once per order and product, reserves the stock, charges (see
 * `app/Storefront/UpsellCharge.ts`) and adds the line to the order in one
 * transaction. A browser form goes back to the order with a notice; a script
 * gets the result.
 */
export default new Action({
  name: 'AcceptOrderOfferAction',
  description: 'Add a discounted post-purchase offer to an order just placed.',
  method: 'POST',
  notice: (result: { status: string }) => result.status === 'requires_action'
    ? 'Your bank needs you to confirm this payment. We have reserved the items for you.'
    : result.status === 'pending'
      ? 'Added to your order. We will confirm the payment shortly.'
      : 'Added to your order.',
  next: (result: { order_id: number, key: string }) => `/orders/${result.order_id}?key=${encodeURIComponent(result.key)}`,

  async handle(request: any) {
    const key = String(request.get('key') ?? '')
    const order = await orderForKey(request.get('order_id'), key)
    if (!order)
      return refuse('We could not find that order.', { status: 404 })

    const variant = request.get('variant_id')
    const result = await upsells.acceptOffer({
      orderId: Number(order.id),
      offerId: Number(request.get('offer_id')),
      productId: Number(request.get('product_id')),
      variantId: variant == null || variant === '' ? null : Number(variant),
      quantity: Number(request.get('quantity')),
      charge: await storefrontUpsellCharger(order),
    })

    if (result.ok)
      return { ok: true, status: result.status, order_id: Number(order.id), key, response_id: result.response.id }

    if (result.reason === 'payment-requires-action') {
      // The bank wants the shopper to confirm. A page with the provider's SDK
      // finishes it from `client_confirmation`, and the payment webhook then
      // adds the line. The items stay reserved meanwhile.
      return {
        ok: false,
        status: 'requires_action',
        order_id: Number(order.id),
        key,
        response_id: result.response.id,
        client_confirmation: result.clientConfirmation ?? null,
        redirect_url: result.redirectUrl ?? null,
      }
    }

    const status = result.reason === 'already-responded' || result.reason === 'out-of-stock' ? 409
      : result.reason === 'payment-failed' ? 402
        : result.reason === 'offer-expired' || result.reason === 'order-closed' ? 410
          : 422
    return refuse(result.message, { status })
  },
})
