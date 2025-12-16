import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { openRepository } from './BuddyService'
import { v } from '@stacksjs/validation'

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
  validations: {
    input: {
      rule: v.string().url(),
      message: {
        url: 'Repository input must be a valid URL',
      },
    },
  },
  async handle(request: RequestInstance) {
    try {
      let input: string | undefined

      // Try to get input from query params first, then from body
      const url = new URL(request.url)
      input = url.searchParams.get('input') || url.searchParams.get('path') || undefined

      if (!input) {
        // Try to get from JSON body
        try {
          const body = await request.json() as { input?: string, path?: string }
          input = body.input || body.path
        }
        catch {
          // No body or invalid JSON
        }
      }

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
