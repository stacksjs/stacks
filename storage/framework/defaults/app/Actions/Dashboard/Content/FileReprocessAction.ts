import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { DashboardFileError, reprocessDashboardFile } from './file-manager'

export default new Action({
  name: 'FileReprocessAction',
  description: 'Re-runs the background processing for a file: image variants, video renditions, AI tags.',
  method: 'POST',
  async handle(request: RequestInstance) {
    try {
      const result = await reprocessDashboardFile({
        disk: String(request.get('disk', 'public')),
        path: request.get('path'),
        // Omit to run every kind the file's content type calls for; name kinds
        // to re-run just one, which is what a failed transcode beside a
        // successful tagging wants.
        kinds: request.get('kinds'),
        // A transcode derives its ladder from the source dimensions, so it only
        // runs when the caller supplies them.
        videoProfile: request.get('profile'),
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
