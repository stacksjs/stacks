import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { DashboardFileError, deleteDashboardFile } from './file-manager'

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
      if (error instanceof DashboardFileError)
        return response.json({ message: error.message, fields: error.fields }, error.status)
      throw error
    }
  },
})
