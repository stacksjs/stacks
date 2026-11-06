import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parseReviewListQuery, readReviewPage } from './commerce-review-list'

/**
 * `GET /api/dashboard/commerce/reviews` - one page of reviews, searched,
 * filtered, sorted and counted by the database, with the summary of every
 * review (commerce-review-list.ts, stacksjs/stacks#3218). It used to return
 * the newest 500 for the browser to do all of that with.
 */
export default new Action({
  name: 'ReviewIndexAction',
  description: 'Returns one page of persisted reviews with their product and customer context for dashboard moderation.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const query = parseReviewListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const reviews = await readReviewPage(query)
      return {
        records: reviews.records,
        total: reviews.total,
        page: reviews.page,
        perPage: query.perPage,
        summary: reviews.summary,
        products: reviews.products,
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Review records could not be read.', 'ReviewIndexAction')
    }
  },
})
