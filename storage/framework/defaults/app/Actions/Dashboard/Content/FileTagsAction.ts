import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { DashboardFileError, setDashboardFileTags } from './file-manager'

export default new Action({
  name: 'FileTagsAction',
  description: 'Replaces the tags on a file or directory on a configured storage disk.',
  method: 'PUT',
  async handle(request: RequestInstance) {
    try {
      const result = await setDashboardFileTags({
        disk: String(request.get('disk', 'public')),
        path: request.get('path'),
        // The whole set, not a delta: a UI that can add a tag can also remove
        // one, and there is no separate signal for a removal.
        tags: request.get('tags'),
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
