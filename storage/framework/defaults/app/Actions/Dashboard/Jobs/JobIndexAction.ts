import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { dashboardOperationalError } from '../dashboard-response'
import { readJobPage } from './job-list'

export default new Action({
  name: 'JobIndexAction',
  description: 'Returns a paginated list of jobs across the active queue and the failed_jobs table.',
  method: 'GET',
  async handle(request: RequestInstance) {
    const page = Math.max(1, Number(request.get('page', 1)) || 1)
    const perPage = Math.min(200, Math.max(1, Number(request.get('per_page', 25)) || 25))
    const queueFilter = String(request.get('queue', '')).trim()
    const statusFilter = String(request.get('status', '')).trim().toLowerCase()
    const search = String(request.get('search', '')).trim().toLowerCase()

    try {
      // An unknown status matched no job before the database did the
      // filtering, and still matches none.
      if (statusFilter && statusFilter !== 'all' && !['queued', 'processing', 'failed'].includes(statusFilter))
        return { data: [], total: 0, page, perPage, queues: [], queueConnected: true }

      const result = await readJobPage({
        page,
        perPage,
        queue: queueFilter === 'all' ? '' : queueFilter,
        status: statusFilter === 'all' ? '' : statusFilter as 'queued' | 'processing' | 'failed' | '',
        search,
      })

      return { data: result.data, total: result.total, page: result.page, perPage, queues: result.queues, queueConnected: true }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Job history could not be loaded.', 'JobIndexAction')
    }
  },
})
