import { Action } from '@stacksjs/actions/runtime'
import { upsells } from '@stacksjs/commerce'
import { refuse } from '@stacksjs/router'
import { orderForKey } from '../../Storefront/OrderKey'

/**
 * "No thanks" on a post-purchase offer: it is not shown to this order again.
 * Authorised by the order's key.
 */
export default new Action({
  name: 'DeclineOrderOfferAction',
  description: 'Turn down a post-purchase offer for an order.',
  method: 'POST',
  next: (result: { order_id: number, key: string }) => `/orders/${result.order_id}?key=${encodeURIComponent(result.key)}`,

  async handle(request: any) {
    const key = String(request.get('key') ?? '')
    const order = await orderForKey(request.get('order_id'), key)
    if (!order)
      return refuse('We could not find that order.', { status: 404 })

    const declined = await upsells.declineOffer(Number(order.id), Number(request.get('offer_id')))
    return { ok: true, order_id: Number(order.id), key, declined }
  },
})
