import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { openRepository } from './BuddyService'

/**
 * Open or clone a repository
 *
 * Request body:
 * - input: GitHub URL or local path
 */
export default new Action({
  name: 'BuddyRepoOpenAction',
  description: 'Open or clone a repository for Buddy to work on',
  method: 'POST',
  async handle(request: RequestInstance) {
    try {
      const body = await request.json() as { input: string }
      const { input } = body

      if (!input) {
        return response.json({ success: false, error: 'Repository input is required' }, { status: 400 })
      }

      const repo = await openRepository(input)
      return response.json({ success: true, repo })
    }
    catch (error) {
      return response.json({ success: false, error: (error as Error).message }, { status: 400 })
    }
  },
})
