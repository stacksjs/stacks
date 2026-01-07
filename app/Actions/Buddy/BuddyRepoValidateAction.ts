import type { RequestInstance } from '@stacksjs/types'
import { existsSync, statSync } from 'node:fs'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

/**
 * Validate that a repository path exists and is a directory
 */
export default new Action({
  name: 'BuddyRepoValidateAction',
  description: 'Validate a repository path',
  method: 'POST',
  async handle(request: RequestInstance) {
    const path = request.get('path')

    if (!path) {
      return response.json({ valid: false, error: 'No path provided' })
    }

    try {
      if (!existsSync(path)) {
        return response.json({ valid: false, error: 'Path does not exist' })
      }

      const stat = statSync(path)
      if (!stat.isDirectory()) {
        return response.json({ valid: false, error: 'Path is not a directory' })
      }

      return response.json({ valid: true })
    }
    catch (error) {
      return response.json({ valid: false, error: 'Path validation failed' })
    }
  },
})
