import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { db } from '@stacksjs/database'
import { dashboardOperationalError } from '../dashboard-response'
import { normalizeAbandonedCarts } from './abandoned-cart-records'

/**
 * Every cart that was filled and then left, and whatever has been done about it.
 *
 * Read straight from `carts` rather than from a rollup: the number a shop acts
 * on has to be the number in the table, and a cached one drifts the moment
 * somebody checks out.
 *
 * `converted` carts are fetched alongside the cold ones because recovery is
 * only measurable as the difference between them - a dashboard that shows
 * only what is still abandoned can say how much money is sitting there and
 * never how much of it came back.
 */
export default new Action({
  name: 'AbandonedCartIndexAction',
  description: 'Returns abandoned carts, their recovery campaigns, and what those campaigns brought back.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const carts = await db
        .selectFrom('carts')
        .selectAll()
        .where('status', 'in', ['abandoned', 'expired', 'converted'])
        .orderBy('updated_at', 'desc')
        .limit(500)
        .execute()

      const cartIds = carts.map(cart => Number(cart.id)).filter(Number.isFinite)
      const customerIds = [...new Set(
        carts.map(cart => Number(cart.customer_id)).filter(id => Number.isFinite(id) && id > 0),
      )]

      /*
       * Both of these are `in` lookups on the carts already fetched, so an
       * empty page asks nothing rather than selecting every row in the table
       * behind an `in ()` that some drivers read as "no filter".
       */
      const [items, customers, campaigns] = await Promise.all([
        cartIds.length > 0
          ? db.selectFrom('cart_items')
              .select(['cart_id', 'quantity', 'product_name'])
              .where('cart_id', 'in', cartIds)
              .execute()
          : Promise.resolve([]),
        customerIds.length > 0
          ? db.selectFrom('customers')
              .select(['id', 'name', 'email'])
              .where('id', 'in', customerIds)
              .execute()
          : Promise.resolve([]),
        db.selectFrom('campaigns')
          .selectAll()
          .whereNotNull('segment_definition')
          .orderBy('id', 'desc')
          .limit(200)
          .execute(),
      ])

      // Only the sends belonging to those campaigns matter, and there is no
      // point reading a newsletter's hundred thousand rows to find out.
      const campaignIds = campaigns.map(campaign => Number(campaign.id)).filter(Number.isFinite)
      const sends = campaignIds.length > 0
        ? await db.selectFrom('campaign_sends')
            .select(['campaign_id', 'recipient', 'sent_at', 'created_at'])
            .where('campaign_id', 'in', campaignIds)
            .where('status', 'in', ['sent', 'delivered'])
            .execute()
        : []

      return normalizeAbandonedCarts(carts, items, customers, campaigns, sends, {
        defaultCurrency: String(config.commerce?.currency || 'USD').toUpperCase(),
      })
    }
    catch (error) {
      return dashboardOperationalError(error, 'Abandoned carts could not be loaded.', 'AbandonedCartIndexAction')
    }
  },
})
