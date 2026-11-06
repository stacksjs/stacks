import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parseGiftCardListQuery, readGiftCardPage } from './commerce-gift-card-list'

/**
 * `GET /api/dashboard/commerce/gift-cards` - one page of gift cards, searched,
 * filtered, sorted and counted by the database, with the summary of every card
 * (commerce-gift-card-list.ts, stacksjs/stacks#3218). It used to return the
 * newest 500 for the browser to do all of that with.
 */
export default new Action({
  name: 'CommerceGiftCardsAction',
  description: 'Returns one page of persisted GiftCard records for dashboard management.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const query = parseGiftCardListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const cards = await readGiftCardPage(query)
      return {
        records: cards.records,
        total: cards.total,
        page: cards.page,
        perPage: query.perPage,
        summary: cards.summary,
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Gift card records could not be read.', 'CommerceGiftCardsAction')
    }
  },
})
