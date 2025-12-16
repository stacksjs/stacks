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
      let input: string | undefined

      // Try to get input from query params first, then from body
      const url = new URL(request.url)
      input = url.searchParams.get('input') || undefined

      if (!input) {
        // Try to get from JSON body
        try {
          const body = await request.json() as { input: string }
          input = body.input
        }
        catch {
          // No body or invalid JSON
        }
      }

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
