import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { duplicateDashboardFile } from './file-manager'
import { dashboardFileFailure } from './file-response'

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
      return dashboardFileFailure(error, 'The file could not be duplicated.', 'FileDuplicateAction')
    }
  },
})
