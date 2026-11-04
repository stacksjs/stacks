import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { setDashboardFileFavorite } from './file-manager'
import { dashboardFileFailure } from './file-response'

export default new Action({
  name: 'FileFavoriteAction',
  description: 'Stars or unstars a file or directory on a configured storage disk.',
  method: 'PUT',
  async handle(request: RequestInstance) {
    try {
      const result = await setDashboardFileFavorite({
        disk: String(request.get('disk', 'public')),
        path: request.get('path'),
        favorite: request.get('favorite'),
      })
      return response.json(result)
    }
    catch (error) {
      return dashboardFileFailure(error, 'The favorite could not be saved.', 'FileFavoriteAction')
    }
  },
})
