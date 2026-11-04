import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { getDashboardFileSnapshot, normalizeDashboardFileLimit } from './file-manager'
import { dashboardFileFailure } from './file-response'

export default new Action({
  name: 'FileIndexAction',
  description: 'Returns real storage data for the dashboard file manager.',
  method: 'GET',
  apiResponse: true,
  async handle(request: RequestInstance) {
    try {
      return await getDashboardFileSnapshot({
        disk: request.get('disk', 'public'),
        maxEntries: normalizeDashboardFileLimit(request.get('limit')),
      })
    }
    catch (error) {
      return dashboardFileFailure(error, 'Files could not be loaded.', 'FileIndexAction')
    }
  },
})
