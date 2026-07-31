import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { DashboardFileError, getDashboardFileSnapshot, normalizeDashboardFileLimit } from './file-manager'

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
      if (error instanceof DashboardFileError)
        return response.json({ message: error.message, fields: error.fields }, error.status)
      throw error
    }
  },
})
