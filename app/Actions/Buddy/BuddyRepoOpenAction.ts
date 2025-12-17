import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { openRepository } from './BuddyService'

/**
 * Open or clone a repository
 *
 * Request body/query:
 * - path, input, repo, or repository: GitHub URL or local path
 */
export default new Action({
  name: 'BuddyRepoOpenAction',
  description: 'Open or clone a repository for Buddy to work on',
  method: 'POST',

  async handle(request: RequestInstance) {
    try {
      // Debug: log what we're receiving
      const allInput = request.all ? request.all() : {}
      console.log('[BuddyRepoOpenAction] All input:', JSON.stringify(allInput))
      console.log('[BuddyRepoOpenAction] jsonBody:', JSON.stringify((request as any).jsonBody))

      // Accept multiple field names for flexibility
      const input = request.get<string>('path')
        || request.get<string>('input')
        || request.get<string>('repo')
        || request.get<string>('repository')

      console.log('[BuddyRepoOpenAction] Resolved input:', input)

      if (!input) {
        return response.unprocessableEntity('Repository input is required', {
          path: ['Provide path, input, repo, or repository field'],
        })
      }

      const repo = await openRepository(input)
      return response.success({ repo })
    }
    catch (error) {
      return response.badRequest((error as Error).message)
    }
  },
})
