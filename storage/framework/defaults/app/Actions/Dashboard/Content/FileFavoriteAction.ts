import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { DashboardFileError, setDashboardFileFavorite } from './file-manager'

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
      if (error instanceof DashboardFileError)
        return response.json({ message: error.message, fields: error.fields }, error.status)
      throw error
    }
  },
})
