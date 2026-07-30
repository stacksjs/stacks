import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { createDashboardDirectory, DashboardFileError } from './file-manager'

export default new Action({
  name: 'FileDirectoryStoreAction',
  description: 'Creates a directory on a configured storage disk.',
  method: 'POST',
  async handle(request: RequestInstance) {
    try {
      const directory = await createDashboardDirectory({
        disk: String(request.get('disk', 'public')),
        path: String(request.get('path', '')),
        name: request.get('name'),
      })
      return response.json(directory, 201)
    }
    catch (error) {
      if (error instanceof DashboardFileError)
        return response.json({ message: error.message, fields: error.fields }, error.status)
      throw error
    }
  },
})
