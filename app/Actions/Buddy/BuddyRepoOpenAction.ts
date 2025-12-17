import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { openRepository } from './BuddyService'

/**
 * Open or clone a repository
 *
 * Request body/query:
 * - input or path: GitHub URL or local path
 */
export default new Action({
  name: 'BuddyRepoOpenAction',
  description: 'Open or clone a repository for Buddy to work on',
  method: 'POST',

  async handle(request: RequestInstance) {
    try {
      // Laravel-style: get from any source (query, body, params)
      const input = request.get<string>('input') || request.get<string>('path')

      if (!input) {
        return response.json({ success: false, error: 'Repository input is required' }, { status: 422 })
      }

      const repo = await openRepository(input)
      return response.json({ success: true, repo })
    }
    catch (error) {
      return response.json({ success: false, error: (error as Error).message }, { status: 400 })
    }
  },
})
