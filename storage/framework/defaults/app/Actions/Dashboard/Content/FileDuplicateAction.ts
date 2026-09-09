import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { DashboardFileError, duplicateDashboardFile } from './file-manager'

export default new Action({
  name: 'FileDuplicateAction',
  description: 'Copies a file or directory beside the original on a configured storage disk.',
  method: 'POST',
  async handle(request: RequestInstance) {
    try {
      const duplicated = await duplicateDashboardFile({
        disk: String(request.get('disk', 'public')),
        path: request.get('path'),
        name: request.get('name'),
      })
      return response.json(duplicated)
    }
    catch (error) {
      if (error instanceof DashboardFileError)
        return response.json({ message: error.message, fields: error.fields }, error.status)
      throw error
    }
  },
})
