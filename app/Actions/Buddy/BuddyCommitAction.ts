import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { commitChanges, CONFIG } from './BuddyService'

/**
 * Stage and commit all changes in the repository
 */
export default new Action({
  name: 'BuddyCommitAction',
  description: 'Commit all staged changes in the repository',
  method: 'POST',
  async handle(_request: RequestInstance) {
    try {
      const hash = await commitChanges()
      return response.json({
        success: true,
        hash,
        message: CONFIG.commitMessage,
      })
    }
    catch (error) {
      return response.json({ success: false, error: (error as Error).message }, { status: 400 })
    }
  },
})
