import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { renameDashboardFile } from './file-manager'
import { dashboardFileFailure } from './file-response'

export default new Action({
  name: 'FileRenameAction',
  description: 'Renames a file or directory in place on a configured storage disk.',
  method: 'PATCH',
  async handle(request: RequestInstance) {
    try {
      const renamed = await renameDashboardFile({
        disk: String(request.get('disk', 'public')),
        path: request.get('path'),
        name: request.get('name'),
      })
      return response.json(renamed)
    }
    catch (error) {
      return dashboardFileFailure(error, 'The file could not be renamed.', 'FileRenameAction')
    }
  },
})
