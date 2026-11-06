import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parsePaymentListQuery, readPaymentPage } from './commerce-payment-list'

/**
 * `GET /api/dashboard/commerce/payments` - one page of payments, searched,
 * filtered, sorted, counted and summarised by the database
 * (commerce-payment-list.ts, stacksjs/stacks#3218). It used to return the
 * newest 500 for the browser to do all of that with.
 */
export default new Action({
  name: 'CommercePaymentsAction',
  description: 'Returns one page of persisted commerce payments with currency-safe summaries of the match.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const query = parsePaymentListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const payments = await readPaymentPage(query)
      return {
        records: payments.records,
        total: payments.total,
        page: payments.page,
        perPage: query.perPage,
        summary: payments.summary,
        breakdown: payments.breakdown,
        statuses: payments.statuses,
        methods: payments.methods,
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Payment records could not be read.', 'CommercePaymentsAction')
    }
  },
})
