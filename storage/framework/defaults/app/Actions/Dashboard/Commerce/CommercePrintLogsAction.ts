import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parsePrintLogListQuery, readPrintLogPage } from './commerce-print-log-list'

/**
 * `GET /api/dashboard/commerce/print-logs` - one page of print logs, with the
 * summary and breakdown of every log the search and filters match
 * (commerce-print-log-list.ts, stacksjs/stacks#3218). The summary used to
 * describe the page alone.
 */
export default new Action({
  name: 'CommercePrintLogsAction',
  description: 'Returns filtered, sorted, paginated Receipt print logs.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const query = parsePrintLogListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      return await readPrintLogPage(query)
    }
    catch (error) {
      return dashboardOperationalError(error, 'Print log records could not be read.', 'CommercePrintLogsAction')
    }
  },
})
