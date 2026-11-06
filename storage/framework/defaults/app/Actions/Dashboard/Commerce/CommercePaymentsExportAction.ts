import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parsePaymentListQuery, readPaymentsForExport } from './commerce-payment-list'
import { paymentsToCsv } from './payment-records'

/**
 * `GET /api/dashboard/commerce/payments/export` - every payment matching the
 * Payments page's search, filters, time range and sort, as CSV
 * (stacksjs/stacks#3218). The page built the file from the newest 500.
 */
export default new Action({
  name: 'CommercePaymentsExportAction',
  description: 'Exports every payment matching the Payments page filters as CSV.',
  method: 'GET',
  apiResponse: false,

  async handle(request: RequestInstance) {
    const query = parsePaymentListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const csv = `﻿${paymentsToCsv(await readPaymentsForExport(query))}`
      const day = new Date().toISOString().slice(0, 10)
      return new Response(csv, {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Disposition': `attachment; filename="payments-${day}.csv"`,
          'Content-Type': 'text/csv; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }
    catch (error) {
      return dashboardOperationalError(error, 'Payments could not be exported.', 'CommercePaymentsExportAction')
    }
  },
})
