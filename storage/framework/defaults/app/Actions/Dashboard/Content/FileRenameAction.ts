import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { DashboardFileError, renameDashboardFile } from './file-manager'

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
      if (error instanceof DashboardFileError)
        return response.json({ message: error.message, fields: error.fields }, error.status)
      throw error
    }
  },
})
