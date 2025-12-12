import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { pushChanges } from './BuddyService'

/**
 * Push committed changes to the remote repository
 */
export default new Action({
  name: 'BuddyPushAction',
  description: 'Push committed changes to the remote repository',
  method: 'POST',
  async handle(_request: RequestInstance) {
    try {
      await pushChanges()
      return response.json({ success: true })
    }
    catch (error) {
      return response.json({ success: false, error: (error as Error).message }, { status: 400 })
    }
  },
})
