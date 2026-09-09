import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { DashboardFileError, setDashboardFileVisibility } from './file-manager'

export default new Action({
  name: 'FileVisibilityAction',
  description: 'Sets a file or directory public or private on a configured storage disk.',
  method: 'PUT',
  async handle(request: RequestInstance) {
    try {
      const updated = await setDashboardFileVisibility({
        disk: String(request.get('disk', 'public')),
        path: request.get('path'),
        visibility: request.get('visibility'),
      })
      return response.json(updated)
    }
    catch (error) {
      if (error instanceof DashboardFileError)
        return response.json({ message: error.message, fields: error.fields }, error.status)
      throw error
    }
  },
})
