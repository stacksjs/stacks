import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { createDashboardDirectory } from './file-manager'
import { dashboardFileFailure } from './file-response'

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
      return dashboardFileFailure(error, 'The folder could not be created.', 'FileDirectoryStoreAction')
    }
  },
})
