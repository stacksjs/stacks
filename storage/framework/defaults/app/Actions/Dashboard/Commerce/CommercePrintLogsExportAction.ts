import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parsePrintLogListQuery, readPrintLogsForExport } from './commerce-print-log-list'
import { printLogsToCsv } from './print-log-records'

/**
 * `GET /api/dashboard/commerce/print-logs/export` - every print log matching
 * the page's search, filters and sort, as CSV (stacksjs/stacks#3218). The
 * page could only export the twenty rows it showed.
 */
export default new Action({
  name: 'CommercePrintLogsExportAction',
  description: 'Exports every print log matching the Print Logs page filters as CSV.',
  method: 'GET',
  apiResponse: false,

  async handle(request: RequestInstance) {
    const query = parsePrintLogListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const csv = `﻿${printLogsToCsv(await readPrintLogsForExport(query))}`
      const day = new Date().toISOString().slice(0, 10)
      return new Response(csv, {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Disposition': `attachment; filename="print-logs-${day}.csv"`,
          'Content-Type': 'text/csv; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }
    catch (error) {
      return dashboardOperationalError(error, 'Print logs could not be exported.', 'CommercePrintLogsExportAction')
    }
  },
})
