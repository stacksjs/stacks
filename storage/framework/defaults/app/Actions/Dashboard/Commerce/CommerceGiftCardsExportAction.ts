import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { minorToInput } from '@stacksjs/commerce/money'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { giftCardsCsv, parseGiftCardListQuery, readGiftCardsForExport } from './commerce-gift-card-list'

/**
 * `GET /api/dashboard/commerce/gift-cards/export` - every gift card matching
 * the Gift Cards page's search, filters and sort, as CSV
 * (stacksjs/stacks#3218). The page built the file from the newest 500.
 */
export default new Action({
  name: 'CommerceGiftCardsExportAction',
  description: 'Exports every gift card matching the Gift Cards page filters as CSV.',
  method: 'GET',
  apiResponse: false,

  async handle(request: RequestInstance) {
    const query = parseGiftCardListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const csv = giftCardsCsv(await readGiftCardsForExport(query), minorToInput)
      const day = new Date().toISOString().slice(0, 10)
      return new Response(csv, {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Disposition': `attachment; filename="gift-cards-${day}.csv"`,
          'Content-Type': 'text/csv; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }
    catch (error) {
      return dashboardOperationalError(error, 'Gift cards could not be exported.', 'CommerceGiftCardsExportAction')
    }
  },
})
