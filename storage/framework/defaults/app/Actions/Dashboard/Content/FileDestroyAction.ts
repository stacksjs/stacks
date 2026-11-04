import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { deleteDashboardFile } from './file-manager'
import { dashboardFileFailure } from './file-response'

export default new Action({
  name: 'FileDestroyAction',
  description: 'Deletes a file or directory from a configured storage disk.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    try {
      const deleted = await deleteDashboardFile({
        disk: String(request.get('disk', 'public')),
        path: request.get('path'),
      })
      return response.json(deleted)
    }
    catch (error) {
      return dashboardFileFailure(error, 'The file could not be deleted.', 'FileDestroyAction')
    }
  },
})
